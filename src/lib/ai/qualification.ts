import type { Conversation, Lead, Property } from "@/types/database";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { MessageIntent } from "@/lib/ai/intent-classifier";

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

const VISIT_PATTERN =
  /\b(visita|visitar|ver o imóvel|agendar|marcar|conhecer|viewing|schedule|marcação|horário|horario)\b/i;

const OPTIONS_REQUEST_PATTERN =
  /\b(opções|opcões|imóveis|imoveis|mostra|mostrar|envia|enviar|manda|mandar|partilha|partilhar|recomenda|sugere|tens algo|tem algo|alguma coisa|algum imóvel|quero ver|ver opções|ver imóveis|mandar opções|enviar opções|procura algo|procuro algo)\b/i;

const MORE_OPTIONS_PATTERN =
  /\b(mostra outras|outras opções|outras opcões|tem mais|tens mais|há mais|ha mais|mais opções|mais opcões|ver semelhantes|semelhantes|outras moradias|outros imóveis|outras casas|mais imóveis|mais imoveis|envia mais|manda mais|outra opção|outra opcão|outras opcoes|alguma mais|mais alguma)\b/i;

const RESHOW_OPTIONS_PATTERN =
  /\b(mostra de novo|mostra novamente|mostra outra vez|envia de novo|enviar de novo|manda de novo|mandar de novo|reenvia|reenviar|podes reenviar|pode reenviar|outra vez|manda outra vez|envia outra vez|volta a enviar|volta a mandar|quais\s*(mesmo|são|sao|eram|opções|opcoes|imóveis|imoveis)?|quais opções|quais opcoes|quais imóveis|quais imoveis)\b/i;

function getLastClientMessage(history: Conversation[]): Conversation | null {
  return (
    [...history].reverse().find((item) => item.sender === "client") ?? null
  );
}

export function getLastClientMessageText(history: Conversation[]): string | null {
  return getLastClientMessage(history)?.message ?? null;
}

/** Client explicitly asked to see listings or options. */
export function clientAskedToSeeOptions(history: Conversation[]): boolean {
  const last = getLastClientMessage(history);
  if (!last) return false;
  if (clientAskedToReshowOptions(history)) {
    return false;
  }
  return (
    OPTIONS_REQUEST_PATTERN.test(last.message) ||
    MORE_OPTIONS_PATTERN.test(last.message)
  );
}

/** Client asked to see the same options again — re-send last batch. */
export function clientAskedToReshowOptions(history: Conversation[]): boolean {
  const last = getLastClientMessage(history);
  if (!last) return false;

  const text = last.message.trim();

  if (MORE_OPTIONS_PATTERN.test(text)) {
    return false;
  }

  if (RESHOW_OPTIONS_PATTERN.test(text)) {
    return true;
  }

  if (/^quais\s*\??$/i.test(text)) {
    return true;
  }

  if (/^quais são\s*\??$/i.test(text)) {
    return true;
  }

  return false;
}

/** Client asked for additional / more listings (re-query database). */
export function clientAskedForMoreOptions(history: Conversation[]): boolean {
  const last = getLastClientMessage(history);
  if (!last) return false;
  return MORE_OPTIONS_PATTERN.test(last.message);
}

/** Visit topic is active only when the latest client message explicitly references it. */
export function lastClientMessageMentionsVisit(
  history: Conversation[]
): boolean {
  const last = getLastClientMessage(history);
  if (!last) return false;
  return VISIT_PATTERN.test(last.message);
}

/** Any client message in history mentions a visit — for logging/debug only. */
export function clientMessagesMentionVisit(history: Conversation[]): boolean {
  return VISIT_PATTERN.test(clientMessages(history));
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
  const visitActive = lastClientMessageMentionsVisit(history);
  const lines = [
    `- Property/details were actually sent in this chat: ${detailsWereSentInHistory(history) ? "yes — you may refer to them" : "no — NEVER claim you already sent details"}`,
    "- NEVER invent addresses, listings, prices, consultant names, or visit confirmations.",
    "- NEVER invent or recall previous schedules, confirmed slots, or bookings unless explicitly stated in this chat.",
    "- If discussing a visit: say you'll check availability and confirm back — do NOT say it is booked.",
    "- Avoid corporate phrases: no 'Agradeço o interesse', 'a equipa entrará em contacto', 'Pode indicar-nos'.",
    "- Do NOT re-ask for info already saved in the lead profile or stated in the current exchange.",
    "- Respond to the LATEST client message first. Older context is background — use only if clearly still relevant.",
  ];

  if (visitActive) {
    lines.push(
      "- Latest message references a visit: respond warmly (e.g. 'Vou verificar a disponibilidade e já lhe confirmo') — but do NOT confirm scheduling."
    );
  } else {
    lines.push(
      "- Latest message does NOT mention visits: do NOT bring up visits, scheduling, or past visit requests in this reply."
    );
    if (lead.visit_requested || lead.visit_datetime_text) {
      lines.push(
        "- CRM shows a past visit request — treat as historical. Do NOT assume it is still active unless the client references it now."
      );
    }
  }

  return lines;
}

function buildSavedLeadMemoryLines(lead: Lead): string[] {
  const lines = [
    "- Saved CRM profile (background reference — do NOT treat as automatic continuation):",
  ];

  lines.push(`  - Orçamento: ${lead.budget?.trim() || "desconhecido"}`);
  lines.push(`  - Zona: ${lead.preferred_area?.trim() || "desconhecida"}`);
  lines.push(`  - Tipo: ${lead.property_type?.trim() || "desconhecido"}`);
  lines.push(`  - Prazo: ${lead.timeline?.trim() || "desconhecido"}`);

  if (lead.visit_requested || lead.visit_datetime_text) {
    lines.push(
      `  - Visita (histórico): ${lead.visit_requested ? "sim" : "não"}${lead.visit_datetime_text ? ` — ${lead.visit_datetime_text}` : ""} — só relevante se o cliente referir agora`
    );
  }

  return lines;
}

export type QualificationDirectiveOptions = {
  propertiesBeingSent?: Property[];
  matchingPropertyCount?: number;
  availability?: PropertyAvailability;
  clientAskedForMore?: boolean;
  clientAskedToReshow?: boolean;
  messageIntent?: MessageIntent;
};

/**
 * Builds a dynamic directive appended to the system prompt so the model
 * qualifies only when needed and avoids forced follow-up questions.
 */
export function buildQualificationDirective(
  history: Conversation[],
  lead: Lead,
  options: QualificationDirectiveOptions = {}
): string {
  const { propertiesBeingSent = [], matchingPropertyCount = 0, availability, clientAskedForMore = false, clientAskedToReshow = false, messageIntent = "unknown" } = options;
  const catalogCount = propertiesBeingSent.length;
  const nextField = getNextField(history, lead);
  const firstReply = isFirstAiReply(history);
  const messageCount = history.length;
  const visitActive = lastClientMessageMentionsVisit(history);
  const budgetAmbiguous = isBudgetAmbiguous(history, lead);
  const latestClient = getLastClientMessageText(history);
  const wantsOptions = clientAskedToSeeOptions(history);

  const lines = [
    "---",
    "Directive for this reply:",
    `- Classified intent: ${messageIntent}`,
    `- Conversation messages in context: ${messageCount} (last ${messageCount} from Supabase)`,
    `- First AI reply: ${firstReply ? "yes — you may greet briefly" : "no — do NOT greet or re-introduce yourself"}`,
    `- Latest client message: ${latestClient ? `"${latestClient.slice(0, 120)}${latestClient.length > 120 ? "…" : ""}"` : "none"}`,
    "- Reply primarily to the latest client message. Use CRM/history only if clearly still relevant.",
    "- Do NOT repeat criteria the client already gave (budget, zone, type, timeline).",
    "- Do NOT end with a question unless one key field is genuinely missing.",
    "- Do NOT mention visits unless the latest client message asks about or references one.",
    "- NEVER use exhausted-catalog lines ('Por agora estas são as melhores…', 'se entrar algo novo aviso') unless the availability block confirms all matches were already shared after a fresh query.",
    ...buildSavedLeadMemoryLines(lead),
    ...buildSafetyLines(history, lead),
  ];

  if (messageIntent === "visit_request") {
    lines.push(
      "- Client wants a visit: acknowledge briefly — do NOT confirm scheduling.",
      "- Do NOT mention old property catalog unless the client referenced it now."
    );
  }

  if (messageIntent === "general_question" || messageIntent === "unknown") {
    lines.push(
      "- Answer the question directly. Do NOT send property listings unless the client asked.",
      "- Do NOT reference old visits or old property batches unless clearly relevant."
    );
  }

  if (catalogCount >= 2) {
    lines.push(
      `- A catalog of ${catalogCount} property cards will be sent after your reply.`,
      clientAskedToReshow
        ? "- Client asked to see the same options again — brief re-send intro only."
        : "- Write ONE brief catalog intro — no question mark, no repeating their search criteria.",
      clientAskedToReshow
        ? "- NEVER say 'já mostrei' or 'já enviei' — the cards are going out now."
        : "- Example: 'Tenho mais algumas 👇' or 'Estas também encaixam.' — then stop.",
      "- Do NOT ask what they think or say there are no more options."
    );
    lines.push(
      "- Reply in natural conversational Portuguese. Statement only — no question.",
      "- Never use corporate/customer-support phrasing."
    );
    return lines.join("\n");
  }

  if (catalogCount === 1) {
    lines.push(
      "- A matching property card will be sent after your reply.",
      clientAskedToReshow
        ? "- Client asked to see the same option again — one brief re-send line only."
        : "- Write ONE brief intro sentence only — no question mark.",
      clientAskedToReshow
        ? "- NEVER say 'já mostrei' without the card following."
        : "- Do NOT say there are no more options — a listing is being sent.",
      clientAskedToReshow
        ? "- Example: 'Volto a enviar 👇' — then stop."
        : "- Example: 'Tenho mais uma opção 👇' — then stop."
    );
    lines.push(
      "- Reply in natural conversational Portuguese. Statement only — no question.",
      "- Never use corporate/customer-support phrasing."
    );
    return lines.join("\n");
  }

  if (
    catalogCount === 0 &&
    availability &&
    (availability.allShown || availability.noMatchesInDatabase) &&
    (clientAskedForMore || wantsOptions)
  ) {
    lines.push(
      "- Client asked for more listings but NONE will be sent this turn (see availability block).",
      "- Follow the availability directive exactly — do NOT promise new cards.",
      "- Do NOT say 'não tenho mais opções' or 'não há mais imóveis' robotically."
    );
    lines.push(
      "- Reply in natural conversational Portuguese. Statement only — no question.",
      "- Never use corporate/customer-support phrasing."
    );
    return lines.join("\n");
  }

  if (visitActive && nextField !== "complete") {
    lines.push(
      "- Client wants a visit but qualification is incomplete.",
      "- Do NOT confirm any visit. Acknowledge briefly.",
      "- Ask for the missing info ONLY if truly needed — one short question max."
    );
  }

  if (nextField === "complete") {
    lines.push(
      "- Qualification: budget, area, property type, and timeline appear covered."
    );
    if (visitActive) {
      lines.push(
        "- Client referenced a visit: respond naturally — e.g. 'Deixa-me ver a disponibilidade e já te digo.'",
        "- Do NOT confirm a date/time, address, or consultant name."
      );
    } else {
      lines.push(
        "- Do NOT mention visits or scheduling unless the client asked.",
        "- Use a short statement — no forced question. Example: 'Perfeito, já tenho o perfil.'",
        "- Only ask if the client seems stuck and you truly need one detail."
      );
    }
    lines.push("- Keep it short, warm, and conversational — like a real consultant texting.");
  } else {
    lines.push(
      `- Next qualification focus (only if genuinely missing): ${FIELD_LABELS[nextField]}`,
      "- Ask about this ONLY if you cannot proceed without it — otherwise use a statement.",
      "- Do NOT mention visits in this reply.",
      "- Do NOT repeat info the client already shared in their latest message."
    );

    switch (nextField) {
      case "property_type":
        lines.push(
          "- If needed: 'Apartamento ou moradia?' — skip if they already said."
        );
        break;
      case "area":
        lines.push("- If needed: 'Alguma zona em mente?' — skip if they already said.");
        break;
      case "budget":
        if (budgetAmbiguous) {
          lines.push(
            "- Budget ambiguous: ONE clarifier only if needed — compra vs arrendamento, or mensal vs total."
          );
        } else {
          lines.push("- If needed: 'Orçamento mais ou menos?' — skip if they already said.");
        }
        break;
      case "timeline":
        lines.push("- Timeline is optional — skip unless naturally relevant.");
        break;
    }
  }

  const discussed = QUALIFICATION_ORDER.filter((field) =>
    isFieldKnown(field, history, lead)
  );
  if (discussed.length > 0) {
    lines.push(
      `- Already known (do NOT repeat back): ${discussed.map((f) => FIELD_LABELS[f]).join(", ")}`
    );
  }

  lines.push(
    "- Reply in natural conversational Portuguese, 1–2 sentences.",
    "- Question is optional — prefer a statement when enough context exists.",
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
