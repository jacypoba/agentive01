import OpenAI from "openai";
import type { Conversation, IntentStatus, Lead } from "@/types/database";

const DEFAULT_MODEL = "gpt-4.1-mini";

const VALID_INTENT_STATUSES: IntentStatus[] = [
  "unknown",
  "browsing",
  "interested",
  "qualified",
  "ready_to_visit",
  "not_interested",
];

export type ExtractedQualification = {
  budget: string | null;
  preferred_area: string | null;
  property_type: string | null;
  timeline: string | null;
  intent_status: IntentStatus;
  visit_requested: boolean;
  visit_datetime_text: string | null;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey });
}

function getModel() {
  return process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
}

function buildTranscript(history: Conversation[]): string {
  return history
    .map((item) => {
      const role =
        item.sender === "client"
          ? "Cliente"
          : item.sender === "ai"
            ? "Assistente"
            : "Consultor";
      return `${role}: ${item.message}`;
    })
    .join("\n");
}

function normalizeIntentStatus(value: unknown): IntentStatus {
  if (
    typeof value === "string" &&
    VALID_INTENT_STATUSES.includes(value as IntentStatus)
  ) {
    return value as IntentStatus;
  }
  return "unknown";
}

function parseExtraction(raw: string): ExtractedQualification {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    budget: typeof parsed.budget === "string" ? parsed.budget.trim() || null : null,
    preferred_area:
      typeof parsed.preferred_area === "string"
        ? parsed.preferred_area.trim() || null
        : null,
    property_type:
      typeof parsed.property_type === "string"
        ? parsed.property_type.trim() || null
        : null,
    timeline:
      typeof parsed.timeline === "string" ? parsed.timeline.trim() || null : null,
    intent_status: normalizeIntentStatus(parsed.intent_status),
    visit_requested: parsed.visit_requested === true,
    visit_datetime_text:
      typeof parsed.visit_datetime_text === "string"
        ? parsed.visit_datetime_text.trim() || null
        : null,
  };
}

export async function extractLeadQualification(
  lead: Lead,
  history: Conversation[]
): Promise<ExtractedQualification> {
  const openai = getOpenAIClient();

  const systemPrompt = `You extract structured real estate lead qualification data from WhatsApp conversations in Portuguese.

Return ONLY valid JSON with this exact shape:
{
  "budget": string | null,
  "preferred_area": string | null,
  "property_type": string | null,
  "timeline": string | null,
  "intent_status": "unknown" | "browsing" | "interested" | "qualified" | "ready_to_visit" | "not_interested",
  "visit_requested": boolean,
  "visit_datetime_text": string | null
}

Rules:
- Extract only what is explicitly stated or strongly implied in the conversation.
- Use null when unknown — do not guess.
- budget: e.g. "até 500 mil €", "800k-1M"
- preferred_area: neighbourhood, city, or region
- property_type: e.g. "T2 apartamento", "moradia 4 quartos"
- timeline: e.g. "3 meses", "imediato", "verão 2026"
- visit_requested: true if client wants or agrees to a visit/meeting
- visit_datetime_text: raw text about when they want to visit, if mentioned
- intent_status: overall buying/renting intent level`;

  const userPrompt = `Lead profile:
Nome: ${lead.client_name}
Interesse inicial: ${lead.interest ?? "n/d"}
Estado atual: ${lead.status}
Orçamento atual: ${lead.budget ?? "n/d"}
Zona atual: ${lead.preferred_area ?? "n/d"}
Tipo atual: ${lead.property_type ?? "n/d"}
Prazo atual: ${lead.timeline ?? "n/d"}

Conversa:
${buildTranscript(history)}`;

  const completion = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 300,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Qualification extraction returned empty response.");
  }

  return parseExtraction(content);
}
