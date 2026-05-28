import OpenAI from "openai";
import { dedupeAiReply } from "@/lib/ai/dedupe-reply";
import { MEMORY_MESSAGE_LIMIT } from "@/lib/ai/conversation-memory";
import {
  buildCatalogComparisonContext,
  buildHeuristicCatalogComparison,
  extractClientPreferences,
} from "@/lib/properties/catalog-comparison";
import { CATALOG_MIN } from "@/lib/properties/property-cards";
import type { Conversation, Lead, Property } from "@/types/database";

const DEFAULT_MODEL = "gpt-4.1-mini";

const CATALOG_COMPARISON_PROMPT = `You are a premium real estate consultant on WhatsApp. The client just received property cards (already sent). Write a brief, elegant comparison — like a confident advisor, not a brochure.

RULES:
- Exactly 1–2 short lines. One observation per line. Separate lines with a single newline.
- Each line under ~80 characters. No paragraphs, no lists, no bullet points.
- Reference listings as "A primeira", "A segunda", etc. (matching send order).
- Compare real differences from the listing data only — interior space, garden, style, location, price tier.
- If client preferences are known, weave one in naturally.
- Modern Portuguese (Portugal). Premium, human, understated.
- NO questions. NO generic closings. NO invented details.

STYLE EXAMPLE (adapt to data):
A primeira parece mais equilibrada pelo espaço interior.
A segunda destaca-se mais pelo jardim e estilo moderno.`;

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
            "Escreve 1–2 linhas curtas. Uma observação por linha.",
          ].join("\n"),
        },
      ],
      temperature: 0.78,
      max_tokens: 65,
      presence_penalty: 0.55,
      frequency_penalty: 0.65,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (reply && reply.length > 10) {
      return sanitizeComparison(dedupeAiReply(reply, history));
    }
  } catch (error) {
    console.warn("[Catalog comparison] AI generation failed, using heuristic", {
      error: error instanceof Error ? error.message : error,
    });
  }

  const fallback = buildHeuristicCatalogComparison(properties, preferences);
  const sanitized = fallback.trim() ? sanitizeComparison(fallback) : null;
  return sanitized ? dedupeAiReply(sanitized, history) : null;
}

function sanitizeComparison(text: string): string {
  const cleaned = text
    .replace(/\?+$/gm, ".")
    .replace(
      /\b(posso ajudar|fico ao dispor|qualquer dúvida|veja com calma)\b/gi,
      ""
    )
    .replace(/^[•·]\s*/gm, "")
    .replace(/\n{3,}/g, "\n")
    .trim();

  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((line) => (line.length > 90 ? `${line.slice(0, 87).trim()}…` : line));

  return lines.join("\n");
}
