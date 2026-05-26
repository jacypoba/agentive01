import type { Conversation, Lead } from "@/types/database";

type QualificationField =
  | "budget"
  | "area"
  | "property_type"
  | "timeline"
  | "complete";

const FIELD_LABELS: Record<QualificationField, string> = {
  budget: "orçamento (budget)",
  area: "zona preferida (preferred area)",
  property_type: "tipo de imóvel (property type)",
  timeline: "prazo / timeline",
  complete: "qualificação completa",
};

/** Order in which to qualify leads — one field per message. */
const QUALIFICATION_ORDER: QualificationField[] = [
  "property_type",
  "area",
  "budget",
  "timeline",
];

function clientMessages(history: Conversation[]): string {
  return history
    .filter((item) => item.sender === "client")
    .map((item) => item.message)
    .join("\n")
    .toLowerCase();
}

function hasPropertyTypeSignal(text: string, leadInterest?: string | null): boolean {
  const combined = `${text} ${leadInterest ?? ""}`.toLowerCase();
  return (
    /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|t[0-4]|quartos?|bedroom|house|apartment|flat)\b/i.test(
      combined
    ) || /\b\d[\s-]*(quartos?|beds?|bedrooms?)\b/i.test(combined)
  );
}

function hasAreaSignal(text: string, leadInterest?: string | null): boolean {
  const combined = `${text} ${leadInterest ?? ""}`.toLowerCase();
  return (
    /\b(zona|bairro|região|localização|area|distrito|cidade|em\s+[a-zà-ú])/i.test(
      combined
    ) ||
    /\b(lisboa|porto|florence|firenze|cascais|sintra|oeiras|faro|coimbra|braga|chiado|alfama|parque das nações)\b/i.test(
      combined
    )
  );
}

function hasBudgetSignal(text: string): boolean {
  return (
    /\b(orçamento|budget|preço|valor|até|entre|max|máximo)\b/i.test(text) ||
    /[€$£]\s*\d|\d[\d.,\s]*(k|mil|milhões?|m\b|eur|euros?)/i.test(text) ||
    /\d{3,}[\d.,]*/.test(text)
  );
}

function hasBudgetContext(text: string): boolean {
  return /\b(arrendar|alugar|arrendamento|renda|mensal|mês|comprar|compra|aquisição|total|venda)\b/i.test(
    text
  );
}

/** Budget mentioned but unclear if rent/buy or monthly/total. */
export function isBudgetAmbiguous(
  history: Conversation[],
  lead?: Lead
): boolean {
  if (lead?.budget?.trim()) {
    return false;
  }

  const text = clientMessages(history);
  if (!hasBudgetSignal(text)) return false;
  if (hasBudgetContext(text)) return false;

  // Bare small numbers without €/mil often ambiguous (e.g. "500", "800")
  if (/\b\d{2,4}\b/.test(text) && !/[€$]|\bmil|\bk\b|\d{3,}/i.test(text)) {
    return true;
  }

  // Amount given but no rent vs purchase context
  return true;
}

function hasTimelineSignal(text: string): boolean {
  return (
    /\b(prazo|timeline|quando|urgente|mês|meses|semana|semanas|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i.test(
      text
    ) ||
    /\b(imediato|breve|60 dias|30 dias|este ano|próximo ano|asap)\b/i.test(text)
  );
}

function isBudgetKnown(history: Conversation[], lead?: Lead): boolean {
  if (lead?.budget?.trim()) {
    return true;
  }
  const text = clientMessages(history);
  return hasBudgetSignal(text) && !isBudgetAmbiguous(history, lead);
}

function isFieldKnown(
  field: QualificationField,
  history: Conversation[],
  lead: Lead
): boolean {
  const clientText = clientMessages(history);

  switch (field) {
    case "property_type":
      return (
        !!lead.property_type?.trim() ||
        hasPropertyTypeSignal(clientText, lead.interest)
      );
    case "area":
      return (
        !!lead.preferred_area?.trim() ||
        hasAreaSignal(clientText, lead.interest)
      );
    case "budget":
      return isBudgetKnown(history, lead);
    case "timeline":
      return !!lead.timeline?.trim() || hasTimelineSignal(clientText);
    case "complete":
      return true;
  }
}

function getNextField(history: Conversation[], lead: Lead): QualificationField {
  if (isBudgetAmbiguous(history, lead)) {
    return "budget";
  }

  for (const field of QUALIFICATION_ORDER) {
    if (!isFieldKnown(field, history, lead)) {
      return field;
    }
  }
  return "complete";
}

function isFirstAiReply(history: Conversation[]): boolean {
  return !history.some((item) => item.sender === "ai" || item.sender === "agent");
}

export function clientWantsVisit(history: Conversation[], lead?: Lead): boolean {
  if (lead?.visit_requested) {
    return true;
  }

  const clientText = clientMessages(history);
  return /\b(visita|visitar|ver o imóvel|agendar|marcar|conhecer|viewing|schedule|marcação)\b/i.test(
    clientText
  );
}

export function detailsWereSentInHistory(history: Conversation[]): boolean {
  return history.some(
    (item) =>
      (item.sender === "ai" || item.sender === "agent") &&
      /\b(morada|address|ref\.|referência|ficha|link|http|€|metros|m²|m2|quartos|documento|pdf|enviei|segue)\b/i.test(
        item.message.toLowerCase()
      )
  );
}

function buildSafetyLines(history: Conversation[], lead: Lead): string[] {
  const lines = [
    `- Property/details were actually sent in this chat: ${detailsWereSentInHistory(history) ? "yes — you may refer to them" : "no — NEVER claim you already sent details"}`,
    "- NEVER invent addresses, listings, prices, consultant names, or visit confirmations.",
    "- If discussing a visit: say you'll check availability and confirm back — do NOT say it is booked.",
    "- Avoid corporate phrases: no 'Agradeço o interesse', 'a equipa entrará em contacto', 'Pode indicar-nos'.",
    "- Do NOT re-ask for info already saved in the lead profile or stated in recent messages.",
  ];

  if (clientWantsVisit(history, lead)) {
    lines.push(
      "- Client wants a visit: respond warmly and naturally (e.g. 'Vou verificar a disponibilidade e já lhe confirmo') — but do NOT confirm scheduling."
    );
  }

  return lines;
}

function buildSavedLeadMemoryLines(lead: Lead): string[] {
  const lines = ["- Saved CRM profile (do NOT ask again for known fields):"];

  lines.push(`  - Orçamento: ${lead.budget?.trim() || "desconhecido"}`);
  lines.push(`  - Zona: ${lead.preferred_area?.trim() || "desconhecida"}`);
  lines.push(`  - Tipo: ${lead.property_type?.trim() || "desconhecido"}`);
  lines.push(`  - Prazo: ${lead.timeline?.trim() || "desconhecido"}`);
  lines.push(
    `  - Visita pedida: ${lead.visit_requested ? "sim" : "não"}${lead.visit_datetime_text ? ` (${lead.visit_datetime_text})` : ""}`
  );

  return lines;
}

/**
 * Builds a dynamic directive appended to the system prompt so the model
 * asks one qualification question at a time and avoids repeated greetings.
 */
export function buildQualificationDirective(
  history: Conversation[],
  lead: Lead
): string {
  const nextField = getNextField(history, lead);
  const firstReply = isFirstAiReply(history);
  const messageCount = history.length;
  const wantsVisit = clientWantsVisit(history, lead);
  const budgetAmbiguous = isBudgetAmbiguous(history, lead);

  const lines = [
    "---",
    "Directive for this reply:",
    `- Conversation messages in context: ${messageCount} (last ${messageCount} from Supabase)`,
    `- First AI reply: ${firstReply ? "yes — you may greet briefly" : "no — do NOT greet or re-introduce yourself"}`,
    "- Continue naturally from the last message — do not reset the conversation.",
    ...buildSavedLeadMemoryLines(lead),
    ...buildSafetyLines(history, lead),
  ];

  if (wantsVisit && nextField !== "complete") {
    lines.push(
      "- Client wants a visit but qualification is incomplete.",
      "- Do NOT confirm any visit. Acknowledge naturally, then ask for the missing info below.",
      "- Example: 'Perfeito 👌 Antes de marcar, só preciso de perceber [missing info] — consegue dizer-me?'"
    );
  }

  if (nextField === "complete") {
    lines.push(
      "- Qualification: budget, area, property type, and timeline appear covered."
    );
    if (wantsVisit) {
      lines.push(
        "- Client wants a visit: respond naturally — e.g. 'Vou verificar a disponibilidade e já lhe confirmo.'",
        "- Do NOT confirm a date/time, address, or consultant name."
      );
    } else {
      lines.push(
        "- Gently suggest a visit or next step when it feels natural — without pressure.",
        "- Example: 'Quer que veja opções para si?' or 'Posso verificar disponibilidade para uma visita?'"
      );
    }
    lines.push("- Keep it short, warm, and conversational — like a real consultant texting.");
  } else {
    lines.push(
      `- Next qualification focus: ${FIELD_LABELS[nextField]}`,
      "- Ask ONLY about this one topic in this message.",
      "- Do not ask about other qualification points yet.",
      "- Sound natural, not like a form. Vary your phrasing."
    );

    switch (nextField) {
      case "property_type":
        lines.push(
          "- Example tones: 'Que tipo de imóvel procura?' / 'Está à procura de apartamento ou moradia?' / 'Quantos quartos precisa?'"
        );
        break;
      case "area":
        lines.push(
          "- Example tones: 'Boa escolha. Prefere alguma zona específica?' / 'Tem alguma zona em mente?' / 'Lisboa, Porto, ou outra?'"
        );
        break;
      case "budget":
        if (budgetAmbiguous) {
          lines.push(
            "- Budget seems ambiguous or incomplete.",
            "- Ask ONE natural clarifying question: compra vs arrendamento, and/or mensal vs total.",
            "- Example: 'Entendi. Está mais inclinado para compra ou arrendamento?' or 'Esse valor seria mensal?'"
          );
        } else {
          lines.push(
            "- Example tones: 'E qual seria o orçamento mais ou menos?' / 'Tem alguma faixa de preço em mente?'"
          );
        }
        break;
      case "timeline":
        lines.push(
          "- Example tones: 'Top. Quando gostaria de avançar?' / 'Tem algum prazo em mente?' / 'É para breve ou ainda a explorar?'"
        );
        break;
    }
  }

  const discussed = QUALIFICATION_ORDER.filter((field) =>
    isFieldKnown(field, history, lead)
  );
  if (discussed.length > 0) {
    lines.push(
      `- Already known: ${discussed.map((f) => FIELD_LABELS[f]).join(", ")}`
    );
  }

  lines.push(
    "- Reply in natural conversational Portuguese, 1–3 sentences, one question only.",
    "- Never use corporate/customer-support phrasing."
  );

  return lines.join("\n");
}

/** Hint for logging / debugging — not used by webhook. */
export function getQualificationStage(
  history: Conversation[],
  lead: Lead
): QualificationField {
  return getNextField(history, lead);
}
