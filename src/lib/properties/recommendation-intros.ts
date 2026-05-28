import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { pickUnusedVariant } from "@/lib/ai/dedupe-reply";
import {
  FIRST_RECOMMENDATION_CATALOG_INTROS,
  FIRST_RECOMMENDATION_SINGLE_INTROS,
  MORE_OPTIONS_CATALOG_INTROS,
  MORE_OPTIONS_SINGLE_INTROS,
} from "@/lib/i18n/messages";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { getShownPropertyIds } from "@/lib/properties/property-cards";
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
      ? FIRST_RECOMMENDATION_CATALOG_INTROS[language]
      : FIRST_RECOMMENDATION_SINGLE_INTROS[language];
  }

  return catalog
    ? MORE_OPTIONS_CATALOG_INTROS[language]
    : MORE_OPTIONS_SINGLE_INTROS[language];
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
