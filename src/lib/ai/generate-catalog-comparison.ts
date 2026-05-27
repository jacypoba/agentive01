import OpenAI from "openai";
import { MEMORY_MESSAGE_LIMIT } from "@/lib/ai/conversation-memory";
import {
  buildCatalogComparisonContext,
  buildHeuristicCatalogComparison,
  extractClientPreferences,
} from "@/lib/properties/catalog-comparison";
import { CATALOG_MIN } from "@/lib/properties/property-cards";
import type { Conversation, Lead, Property } from "@/types/database";

const DEFAULT_MODEL = "gpt-4.1-mini";

const CATALOG_COMPARISON_PROMPT = `You are a premium real estate consultant on WhatsApp. The client just received a numbered catalog of property cards (already sent). Write a brief, consultative comparison — like a real advisor texting after sharing options.

RULES:
- 1–2 short sentences MAX. One or two observations total — never a list of all properties.
- Reference listings as "a primeira", "a segunda", "a terceira", "a quarta" (matching send order).
- Compare real differences: price, size, location, style — only from the listing data provided.
- If client preferences are known, connect one observation to them naturally.
- Confident, human, modern Portuguese (Portugal). Premium but not corporate.
- NO questions. NO generic closings ("veja com calma", "qualquer dúvida", "fico ao dispor").
- NEVER invent features, renovations, views, or details not in the listing data.

TONE EXAMPLES (adapt to actual data):
- "A primeira parece mais equilibrada pelo preço."
- "A segunda tem um perfil mais premium."
- "A terceira pode fazer mais sentido se valoriza espaço exterior."
- "Esta encaixa melhor para quem quer algo mais moderno."`;

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

function buildRecentClientContext(history: Conversation[]): string {
  const recent = history
    .filter((item) => item.sender === "client")
    .slice(-3)
    .map((item) => item.message);

  if (recent.length === 0) return "Sem mensagens recentes do cliente.";
  return recent.join("\n");
}

export async function generateCatalogComparison(
  lead: Lead,
  history: Conversation[],
  properties: Property[]
): Promise<string | null> {
  if (properties.length < CATALOG_MIN) {
    return null;
  }

  const preferences = extractClientPreferences(lead, history);
  const listingContext = buildCatalogComparisonContext(
    properties,
    lead,
    history
  );

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: "system", content: CATALOG_COMPARISON_PROMPT },
        {
          role: "user",
          content: [
            listingContext,
            "",
            "Últimas mensagens do cliente:",
            buildRecentClientContext(history.slice(-MEMORY_MESSAGE_LIMIT)),
            "",
            "Escreve 1–2 frases curtas de comparação consultiva.",
          ].join("\n"),
        },
      ],
      temperature: 0.82,
      max_tokens: 90,
      presence_penalty: 0.5,
      frequency_penalty: 0.6,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (reply && reply.length > 10) {
      return sanitizeComparison(reply);
    }
  } catch (error) {
    console.warn("[Catalog comparison] AI generation failed, using heuristic", {
      error: error instanceof Error ? error.message : error,
    });
  }

  const fallback = buildHeuristicCatalogComparison(properties, preferences);
  return fallback.trim() || null;
}

function sanitizeComparison(text: string): string {
  return text
    .replace(/\?+$/g, ".")
    .replace(
      /\b(posso ajudar|fico ao dispor|qualquer dúvida|veja com calma)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}
