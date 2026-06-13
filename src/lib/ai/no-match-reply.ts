import {
  polishConversationalReply,
  withConversationalOpener,
} from "@/lib/ai/conversation-quality-v1";
import {
  isNearDuplicateReply,
  pickUnusedVariant,
} from "@/lib/ai/dedupe-reply";
import { NO_MATCH_LINES } from "@/lib/i18n/messages";
import { getConsultantLanguageFallback } from "@/lib/i18n/reply-language";
import { logConsultantFallbackUsed } from "@/lib/ai/forensic-production-logs";
import type { SupportedLanguage } from "@/lib/i18n/types";
import type { Conversation } from "@/types/database";

/**
 * Picks a no-match intro that was not recently sent. Rotates through NO_MATCH_LINES
 * before falling back to a consultant-safe line when all variants are exhausted.
 */
export function pickNoMatchIntroReply(
  language: SupportedLanguage,
  history: Conversation[],
  leadId: string
): string {
  const seed = `${leadId}:no-match`;
  const variant = pickUnusedVariant(NO_MATCH_LINES[language], history, seed);
  const templated = withConversationalOpener(variant, language, seed);

  if (variant.trim() && !isNearDuplicateReply(variant, history)) {
    return polishConversationalReply(templated, language, seed);
  }

  const fallbackBody = getConsultantLanguageFallback(language);
  logConsultantFallbackUsed({
    source: "getConsultantLanguageFallback",
    reason: "pickNoMatchIntroReply_variants_exhausted_or_duplicate",
    intent: "property_search",
    propertyV1Applied: false,
    gatedQualifyingReply: null,
    propertiesToRecommendLength: 0,
    availability: {
      matchingTotal: 0,
      shownCount: 0,
      remainingCount: 0,
      toSend: [],
      remainingAfterSend: 0,
      allShown: false,
      noMatchesInDatabase: true,
      criteriaMissing: false,
    },
    leadId,
    fallbackPreview: fallbackBody,
  });
  const fallback = withConversationalOpener(
    fallbackBody,
    language,
    `${leadId}:consultant-fallback`
  );
  if (fallbackBody.trim() && !isNearDuplicateReply(fallbackBody, history)) {
    return polishConversationalReply(
      fallback,
      language,
      `${leadId}:consultant-fallback`
    );
  }

  return polishConversationalReply(
    templated.trim() || fallback,
    language,
    seed
  );
}
