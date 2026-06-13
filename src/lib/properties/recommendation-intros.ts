import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { normalizeForDedupe, pickUnusedVariant } from "@/lib/ai/dedupe-reply";
import {
  sanitizePropertyRecommendationIntro,
  type ReplyGuardContext,
} from "@/lib/ai/guardrails";
import {
  getFirstRecommendationCatalogIntros,
  getFirstRecommendationSingleIntros,
  getMoreOptionsCatalogIntros,
  getMoreOptionsSingleIntros,
} from "@/lib/i18n/messages";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { getShownPropertyIds } from "@/lib/properties/property-cards";
import type { OutboundWhatsAppMessage } from "@/lib/properties/send-whatsapp";
import type { Conversation } from "@/types/database";

export function shouldUseFirstRecommendationIntro(
  history: Conversation[],
  classified: ClassifiedIntent,
  freshQueryMade: boolean
): boolean {
  if (getShownPropertyIds(history).size === 0) {
    return true;
  }

  if (classified.intent === "property_search" && freshQueryMade) {
    return true;
  }

  return false;
}

function getIntroVariants(
  language: SupportedLanguage,
  propertyCount: number,
  isFirstBatch: boolean
): string[] {
  const catalog = propertyCount >= 2;

  if (isFirstBatch) {
    return catalog
      ? getFirstRecommendationCatalogIntros(language)
      : getFirstRecommendationSingleIntros(language);
  }

  return catalog
    ? getMoreOptionsCatalogIntros(language)
    : getMoreOptionsSingleIntros(language);
}

export function buildRecommendationIntroText(
  language: SupportedLanguage,
  history: Conversation[],
  leadId: string,
  propertyCount: number,
  classified: ClassifiedIntent,
  freshQueryMade: boolean
): string {
  const isFirstBatch = shouldUseFirstRecommendationIntro(
    history,
    classified,
    freshQueryMade
  );
  const variants = getIntroVariants(language, propertyCount, isFirstBatch);
  const seed = `${leadId}:${classified.intent}:${propertyCount}:${isFirstBatch ? "first" : "more"}`;

  return pickUnusedVariant(variants, history, seed);
}

export function preparePropertyRecommendationIntroOutbound(
  introText: string,
  seenThisTurn: Set<string>,
  outboundMessages: OutboundWhatsAppMessage[],
  context: ReplyGuardContext
): string | null {
  const trimmed = introText.trim();
  if (!trimmed) {
    return null;
  }

  const isAlreadyQueued = (text: string): boolean => {
    const normalized = normalizeForDedupe(text);
    if (seenThisTurn.has(normalized)) {
      return true;
    }

    return outboundMessages.some(
      (message) =>
        message.kind === "text" &&
        normalizeForDedupe(message.text) === normalized
    );
  };

  if (isAlreadyQueued(trimmed)) {
    return null;
  }

  const sanitized = sanitizePropertyRecommendationIntro(trimmed, context);
  if (!sanitized || isAlreadyQueued(sanitized)) {
    return null;
  }

  seenThisTurn.add(normalizeForDedupe(sanitized));
  return sanitized;
}
