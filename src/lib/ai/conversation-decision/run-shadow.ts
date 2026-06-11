import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { shouldRunFreshPropertyQuery } from "@/lib/ai/intent-classifier";
import { getActivePendingPropertyOffer } from "@/lib/ai/pending-property-offer";
import type { CityAlternativeSummary } from "@/lib/properties/city-alternatives";
import type { PropertyRecommendationGateResult } from "@/lib/properties/recommendation-gate";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { NormalizedPropertySearch } from "@/lib/properties/normalize-search";
import { derivePropertySearchDebug } from "@/lib/properties/search-criteria";
import type { Conversation, Lead } from "@/types/database";
import type { SupportedLanguage } from "@/lib/i18n/types";
import {
  buildConversationDecisionShadow,
  isConversationDecisionShadowEnabled,
} from "./build-shadow";
import {
  buildCurrentFlowCriteria,
  buildShadowDiff,
  logConversationDecisionShadow,
  previewMessage,
} from "./log-shadow";
import type { InventorySummary } from "./types";

export function runConversationDecisionShadowTurn(input: {
  leadId: string;
  latestMessage: string;
  history: Conversation[];
  lead: Lead;
  language: SupportedLanguage;
  classified: ClassifiedIntent;
  searchDebug?: NormalizedPropertySearch | null;
  propertiesToRecommendCount: number;
  availability: PropertyAvailability;
  cityAlternatives: CityAlternativeSummary | null;
  recommendationGate: PropertyRecommendationGateResult | null;
}): void {
  if (!isConversationDecisionShadowEnabled()) {
    return;
  }

  const pendingOffer = getActivePendingPropertyOffer(input.lead);
  const preferLatest = shouldRunFreshPropertyQuery(input.classified);
  const searchDebug =
    input.searchDebug ??
    derivePropertySearchDebug(input.lead, input.history, {
      preferLatestMessage: preferLatest,
    });

  const inventorySummary: InventorySummary = {
    matchCount: input.availability.matchingTotal,
    alternativeCities: input.cityAlternatives?.availableCities ?? [],
    criteriaMissing: input.availability.criteriaMissing,
  };

  const decision = buildConversationDecisionShadow({
    latestMessage: input.latestMessage,
    history: input.history,
    lead: input.lead,
    pendingPropertyOffer: pendingOffer,
    language: input.language,
    inventorySummary,
  });

  const currentCriteria = buildCurrentFlowCriteria(
    input.lead,
    input.history,
    searchDebug,
    pendingOffer,
    input.classified.intent
  );

  const gateBlocked =
    input.recommendationGate != null &&
    !input.recommendationGate.shouldSendRecommendations &&
    input.recommendationGate.qualifyingReply != null;

  const differences = buildShadowDiff({
    classified: input.classified,
    decision,
    currentCriteria,
    hasProperties: input.propertiesToRecommendCount > 0,
    hasCityAlternatives:
      (input.cityAlternatives?.availableCities.length ?? 0) > 0,
    gateBlocked,
  });

  logConversationDecisionShadow({
    leadId: input.leadId,
    latestMessagePreview: previewMessage(input.latestMessage),
    currentFlowIntent: input.classified.intent,
    decision,
    differences,
  });
}
