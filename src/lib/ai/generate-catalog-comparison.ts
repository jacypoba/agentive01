import OpenAI from "openai";
import { dedupeAiReply } from "@/lib/ai/dedupe-reply";
import {
  finalizeWhatsAppLines,
  wasCutByTokenLimit,
} from "@/lib/ai/complete-response";
import { MEMORY_MESSAGE_LIMIT } from "@/lib/ai/conversation-memory";
import {
  AI_LANGUAGE_INSTRUCTION,
  CATALOG_COMPARISON_PROMPTS,
  getRecentClientContextHeader,
  getRecentClientContextLabel,
} from "@/lib/i18n/messages";
import { enforceReplyLanguage } from "@/lib/i18n/language-purity";
import { getLeadLanguage } from "@/lib/i18n/sync-language";
import type { SupportedLanguage } from "@/lib/i18n/types";
import {
  buildCatalogComparisonContext,
  buildHeuristicCatalogComparison,
  extractClientPreferences,
} from "@/lib/properties/catalog-comparison";
import { CATALOG_MIN } from "@/lib/properties/property-cards";
import type { Conversation, Lead, Property } from "@/types/database";

const DEFAULT_MODEL = "gpt-4.1-mini";

const CATALOG_COMPARISON_BASE = `You are a premium real estate consultant on WhatsApp. The client just received property cards (already sent). Write a brief, elegant comparison — like a confident advisor, not a brochure.

RULES:
- Exactly 1–2 short lines. One complete observation per line. Separate lines with a single newline.
- Each line must be a FULL sentence ending with . ! or ?
- NEVER trail off with "...", "both...", "and...", "but...", "however...", or any unfinished clause.
- Each line under ~90 characters. No paragraphs, no lists, no bullet points.
- Compare real differences from the listing data only — interior space, garden, style, location, price tier.
- If client preferences are known, weave one in naturally.
- Premium, human, understated.
- NO questions. NO generic closings. NO invented details.`;

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

function buildRecentClientContext(
  history: Conversation[],
  language: ReturnType<typeof getLeadLanguage>
): string {
  const recent = history
    .filter((item) => item.sender === "client")
    .slice(-3)
    .map((item) => item.message);

  if (recent.length === 0) return getRecentClientContextLabel(language);
  return recent.join("\n");
}

export async function generateCatalogComparison(
  lead: Lead,
  history: Conversation[],
  properties: Property[],
  languageOverride?: SupportedLanguage
): Promise<string | null> {
  if (properties.length < CATALOG_MIN) {
    return null;
  }

  const language = languageOverride ?? getLeadLanguage(lead);
  const preferences = extractClientPreferences(lead, history);
  const listingContext = buildCatalogComparisonContext(
    properties,
    lead,
    history,
    language
  );

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: "system",
          content: [
            CATALOG_COMPARISON_BASE,
            AI_LANGUAGE_INSTRUCTION[language],
            CATALOG_COMPARISON_PROMPTS[language],
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            listingContext,
            "",
            getRecentClientContextHeader(language),
            buildRecentClientContext(history.slice(-MEMORY_MESSAGE_LIMIT), language),
            "",
            CATALOG_COMPARISON_PROMPTS[language],
          ].join("\n"),
        },
      ],
      temperature: 0.78,
      max_tokens: 140,
      presence_penalty: 0.55,
      frequency_penalty: 0.65,
    });

    const choice = completion.choices[0];
    const reply = choice?.message?.content?.trim();
    const cutShort = wasCutByTokenLimit(choice?.finish_reason);

    if (reply && reply.length > 10 && !cutShort) {
      const sanitized = sanitizeComparison(dedupeAiReply(reply, history));
      if (sanitized) {
        const { text } = enforceReplyLanguage(sanitized, language);
        return text;
      }
    }

    if (cutShort) {
      console.warn("[Catalog comparison] Model output hit token limit — using heuristic", {
        leadId: lead.id,
        preview: reply?.slice(0, 80),
      });
    }
  } catch (error) {
    console.warn("[Catalog comparison] AI generation failed, using heuristic", {
      error: error instanceof Error ? error.message : error,
    });
  }

  const fallback = buildHeuristicCatalogComparison(
    properties,
    preferences,
    language
  );
  const sanitized = fallback.trim()
    ? sanitizeComparison(fallback)
    : null;
  if (!sanitized) {
    return null;
  }
  const deduped = dedupeAiReply(sanitized, history);
  if (!deduped) {
    return null;
  }
  return enforceReplyLanguage(deduped, language).text;
}

function sanitizeComparison(text: string): string | null {
  const cleaned = text
    .replace(/\?+$/gm, ".")
    .replace(
      /\b(posso ajudar|fico ao dispor|qualquer dúvida|veja com calma|happy to help|just reach out)\b/gi,
      ""
    )
    .replace(/^[•·]\s*/gm, "")
    .replace(/\n{3,}/g, "\n")
    .trim();

  return finalizeWhatsAppLines(cleaned, { maxLines: 2, maxLineLength: 100 });
}
