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
    /\b(zona|bairro|região|localização|area|distrito|cidade|em\s+[A-ZÀ-Ú])/i.test(
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

function hasTimelineSignal(text: string): boolean {
  return (
    /\b(prazo|timeline|quando|urgente|mês|meses|semana|semanas|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i.test(
      text
    ) ||
    /\b(imediato|breve|60 dias|30 dias|este ano|próximo ano|asap)\b/i.test(text)
  );
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
      return hasBudgetSignal(clientText);
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

  const lines = [
    "---",
    "Directive for this reply:",
    `- Conversation messages so far: ${messageCount}`,
    `- First AI reply: ${firstReply ? "yes — you may greet briefly" : "no — do NOT greet or re-introduce yourself"}`,
  ];

  if (nextField === "complete") {
    lines.push(
      "- Qualification: budget, area, property type, and timeline appear covered.",
      "- Focus: propose scheduling a visit or call. Offer 2 specific time options if possible.",
      "- Keep it short, warm, and conversion-oriented."
    );
  } else {
    lines.push(
      `- Next qualification focus: ${FIELD_LABELS[nextField]}`,
      "- Ask ONLY about this one topic in this message.",
      "- Do not ask about other qualification points yet."
    );

    switch (nextField) {
      case "property_type":
        lines.push(
          "- Example angle: what type of property and how many bedrooms they need."
        );
        break;
      case "area":
        lines.push(
          "- Example angle: which neighbourhood, city, or region they prefer."
        );
        break;
      case "budget":
        lines.push(
          "- Example angle: comfortable budget range — be tactful and premium in tone."
        );
        break;
      case "timeline":
        lines.push(
          "- Example angle: when they plan to decide, visit, or move."
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
    "- Remember: reply in conversational Portuguese, 1–3 sentences, one question only."
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
