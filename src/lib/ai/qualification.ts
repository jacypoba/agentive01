import type { Conversation } from "@/types/database";

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
export function isBudgetAmbiguous(history: Conversation[]): boolean {
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

function isBudgetKnown(history: Conversation[]): boolean {
  const text = clientMessages(history);
  return hasBudgetSignal(text) && !isBudgetAmbiguous(history);
}

function isFieldKnown(
  field: QualificationField,
  history: Conversation[],
  leadInterest?: string | null
): boolean {
  const clientText = clientMessages(history);

  switch (field) {
    case "property_type":
      return hasPropertyTypeSignal(clientText, leadInterest);
    case "area":
      return hasAreaSignal(clientText, leadInterest);
    case "budget":
      return isBudgetKnown(history);
    case "timeline":
      return hasTimelineSignal(clientText);
    case "complete":
      return true;
  }
}

function getNextField(
  history: Conversation[],
  leadInterest?: string | null
): QualificationField {
  // Prioritise budget clarification when amount is ambiguous
  if (isBudgetAmbiguous(history)) {
    return "budget";
  }

  for (const field of QUALIFICATION_ORDER) {
    if (!isFieldKnown(field, history, leadInterest)) {
      return field;
    }
  }
  return "complete";
}

function isFirstAiReply(history: Conversation[]): boolean {
  return !history.some((item) => item.sender === "ai" || item.sender === "agent");
}

export function clientWantsVisit(history: Conversation[]): boolean {
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

function buildSafetyLines(history: Conversation[]): string[] {
  const lines = [
    `- Property/details were actually sent in this chat: ${detailsWereSentInHistory(history) ? "yes — you may refer to them" : "no — NEVER claim you already sent details"}`,
    "- NEVER invent addresses, listings, prices, consultant names, or visit confirmations.",
    "- If discussing a visit: say you'll check availability and confirm back — do NOT say it is booked.",
    "- Avoid corporate phrases: no 'Agradeço o interesse', 'a equipa entrará em contacto', 'Pode indicar-nos'.",
  ];

  if (clientWantsVisit(history)) {
    lines.push(
      "- Client wants a visit: respond warmly and naturally (e.g. 'Vou verificar a disponibilidade e já lhe confirmo') — but do NOT confirm scheduling."
    );
  }

  return lines;
}

/**
 * Builds a dynamic directive appended to the system prompt so the model
 * asks one qualification question at a time and avoids repeated greetings.
 */
export function buildQualificationDirective(
  history: Conversation[],
  leadInterest?: string | null
): string {
  const nextField = getNextField(history, leadInterest);
  const firstReply = isFirstAiReply(history);
  const messageCount = history.length;
  const wantsVisit = clientWantsVisit(history);
  const budgetAmbiguous = isBudgetAmbiguous(history);

  const lines = [
    "---",
    "Directive for this reply:",
    `- Conversation messages so far: ${messageCount}`,
    `- First AI reply: ${firstReply ? "yes — you may greet briefly" : "no — do NOT greet or re-introduce yourself"}`,
    ...buildSafetyLines(history),
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
    isFieldKnown(field, history, leadInterest)
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
  leadInterest?: string | null
): QualificationField {
  return getNextField(history, leadInterest);
}
