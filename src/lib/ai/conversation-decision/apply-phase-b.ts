import { searchMatchingProperties } from "@/lib/data/properties";
import { analyzePropertyAvailability } from "@/lib/properties/property-availability";
import { findCityAlternativesForCriteria } from "@/lib/properties/find-city-alternatives";
import {
  citiesMatch,
  normalizeSearchCriteria,
} from "@/lib/properties/normalize-search";
import type { CityAlternativeSummary } from "@/lib/properties/city-alternatives";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  Database,
  Lead,
  PendingPropertyOffer,
  Property,
  PropertySearchCriteria,
} from "@/types/database";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { buildConversationDecisionShadow } from "./build-shadow";
import { resolveCriteriaShadow } from "./resolve-criteria-shadow";
import type {
  ConversationDecision,
  DecisionSearchCriteria,
  InventorySummary,
} from "./types";

type Client = SupabaseClient<Database>;

export type PhaseBPropertyResolution = {
  propertiesToRecommend: Property[];
  availability: PropertyAvailability;
  criteria: PropertySearchCriteria | null;
  isReshow: false;
  freshQueryMade: true;
  cityAlternatives: CityAlternativeSummary | null;
  decision: ConversationDecision;
  oldPendingCity: string;
};

export function isConversationDecisionEnginePhaseBEnabled(): boolean {
  const flag = process.env.CONVERSATION_DECISION_ENGINE_PHASE_B?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}

export function shouldApplyPhaseBCityOverride(
  decision: ConversationDecision
): boolean {
  return (
    decision.contextUse.userOverrodePendingOffer &&
    decision.action === "show_properties" &&
    decision.criteria.city != null
  );
}

export function decisionCriteriaToSearchCriteria(
  criteria: DecisionSearchCriteria
): PropertySearchCriteria | null {
  if (!criteria.city?.trim() || !criteria.propertyType?.trim()) {
    return null;
  }

  return normalizeSearchCriteria({
    city: criteria.city,
    propertyType: criteria.propertyType,
    maxBudget: criteria.budget ?? undefined,
    neighborhood: criteria.neighborhood ?? undefined,
  });
}

export function filterPropertiesForDecisionCity(
  properties: Property[],
  decisionCity: string
): Property[] {
  return properties.filter((property) =>
    citiesMatch(decisionCity, property.city)
  );
}

export function logConversationDecisionPhaseBApplied(input: {
  leadId: string;
  reason: string;
  oldPendingCity: string;
  decisionCity: string;
  criteria: DecisionSearchCriteria;
}): void {
  console.log("[Conversation Decision Phase B Applied]", {
    leadId: input.leadId,
    reason: input.reason,
    oldPendingCity: input.oldPendingCity,
    decisionCity: input.decisionCity,
    criteria: input.criteria,
  });
}

export async function tryApplyPhaseBCityOverride(
  supabase: Client,
  memoryLead: Lead,
  history: Conversation[],
  latestMessage: string,
  classified: ClassifiedIntent,
  pendingOffer: PendingPropertyOffer,
  language: ConversationDecision["language"]
): Promise<PhaseBPropertyResolution | null> {
  if (!isConversationDecisionEnginePhaseBEnabled()) {
    return null;
  }

  if (classified.intent !== "accept_pending_offer") {
    return null;
  }

  const resolved = resolveCriteriaShadow(latestMessage, memoryLead, pendingOffer);
  if (
    !resolved.contextUse.userOverrodePendingOffer ||
    !resolved.criteria.city
  ) {
    return null;
  }

  const searchCriteria = decisionCriteriaToSearchCriteria(resolved.criteria);
  if (!searchCriteria) {
    return null;
  }

  const workspaceId = requireLeadWorkspaceId(memoryLead);
  let matchingProperties = await searchMatchingProperties(
    supabase,
    workspaceId,
    searchCriteria,
    20
  );

  matchingProperties = filterPropertiesForDecisionCity(
    matchingProperties,
    resolved.criteria.city
  );

  let cityAlternatives: CityAlternativeSummary | null = null;
  if (matchingProperties.length === 0) {
    cityAlternatives = await findCityAlternativesForCriteria(
      supabase,
      workspaceId,
      searchCriteria
    );
  }

  const inventorySummary: InventorySummary = {
    matchCount: matchingProperties.length,
    alternativeCities: cityAlternatives?.availableCities ?? [],
    criteriaMissing: false,
  };

  const decision = buildConversationDecisionShadow({
    latestMessage,
    history,
    lead: memoryLead,
    pendingPropertyOffer: pendingOffer,
    language,
    inventorySummary,
  });

  if (!shouldApplyPhaseBCityOverride(decision)) {
    return null;
  }

  const availability = analyzePropertyAvailability(
    matchingProperties,
    history,
    true
  );

  let propertiesToRecommend = filterPropertiesForDecisionCity(
    availability.toSend,
    resolved.criteria.city
  );

  logConversationDecisionPhaseBApplied({
    leadId: memoryLead.id,
    reason: decision.reason,
    oldPendingCity: pendingOffer.offeredCity,
    decisionCity: resolved.criteria.city,
    criteria: decision.criteria,
  });

  return {
    propertiesToRecommend,
    availability: {
      ...availability,
      toSend: propertiesToRecommend,
      matchingTotal: matchingProperties.length,
    },
    criteria: searchCriteria,
    isReshow: false,
    freshQueryMade: true,
    cityAlternatives,
    decision,
    oldPendingCity: pendingOffer.offeredCity,
  };
}
