import { searchMatchingProperties } from "@/lib/data/properties";
import { findCityAlternativesForCriteria } from "@/lib/properties/find-city-alternatives";
import type { CityAlternativeSummary } from "@/lib/properties/city-alternatives";
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
import type { SupportedLanguage } from "@/lib/i18n/types";
import { buildConversationDecisionShadow } from "./build-shadow";
import { decisionCriteriaToSearchCriteria, filterPropertiesForDecisionCity } from "./apply-phase-b";
import { hasPropertyPivotEvidence } from "./apply-phase-b2";
import {
  resolveCriteriaShadow,
  type ResolvedCriteriaShadow,
} from "./resolve-criteria-shadow";
import { selectActionShadow, selectActionShadowForPivot } from "./select-action-shadow";
import type { ConversationDecision, InventorySummary } from "./types";

type Client = SupabaseClient< Database>;

export type BuiltPropertyDecision = {
  decision: ConversationDecision;
  resolved: ResolvedCriteriaShadow;
  matchingProperties: Property[];
  cityAlternatives: CityAlternativeSummary | null;
  searchCriteria: PropertySearchCriteria | null;
};

function shouldUsePivotActionSelector(
  resolved: ResolvedCriteriaShadow,
  latestMessage: string,
  pendingOffer: PendingPropertyOffer | null
): boolean {
  return hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer);
}

export async function buildPropertyConversationDecision(
  supabase: Client,
  memoryLead: Lead,
  history: Conversation[],
  latestMessage: string,
  language: SupportedLanguage,
  pendingOffer: PendingPropertyOffer | null
): Promise<BuiltPropertyDecision> {
  const resolved = resolveCriteriaShadow(latestMessage, memoryLead, pendingOffer);
  const usePivotSelector = shouldUsePivotActionSelector(
    resolved,
    latestMessage,
    pendingOffer
  );

  if (
    usePivotSelector &&
    !resolved.criteria.propertyType?.trim()
  ) {
    const decision = buildConversationDecisionShadow({
      latestMessage,
      history,
      lead: memoryLead,
      pendingPropertyOffer: pendingOffer,
      language,
      inventorySummary: {
        matchCount: 0,
        alternativeCities: [],
        criteriaMissing: true,
      },
    });

    return {
      decision: {
        ...decision,
        action: "ask_clarifying_question",
        reason: "pivot_missing_property_type",
        replyInstruction: {
          kind: "deterministic",
          template: "qualifying_question",
        },
      },
      resolved,
      matchingProperties: [],
      cityAlternatives: null,
      searchCriteria: null,
    };
  }

  const searchCriteria = decisionCriteriaToSearchCriteria(resolved.criteria);

  if (!searchCriteria) {
    const inventorySummary: InventorySummary = {
      matchCount: 0,
      alternativeCities: [],
      criteriaMissing: true,
    };
    const decision = buildConversationDecisionShadow({
      latestMessage,
      history,
      lead: memoryLead,
      pendingPropertyOffer: pendingOffer,
      language,
      inventorySummary,
    });

    return {
      decision,
      resolved,
      matchingProperties: [],
      cityAlternatives: null,
      searchCriteria: null,
    };
  }

  const workspaceId = requireLeadWorkspaceId(memoryLead);
  let matchingProperties = await searchMatchingProperties(
    supabase,
    workspaceId,
    searchCriteria,
    20
  );

  if (resolved.criteria.city?.trim()) {
    matchingProperties = filterPropertiesForDecisionCity(
      matchingProperties,
      resolved.criteria.city
    );
  }

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

  const selected = usePivotSelector
    ? selectActionShadowForPivot(latestMessage, resolved, inventorySummary)
    : selectActionShadow(latestMessage, history, resolved, inventorySummary);

  const decision: ConversationDecision = {
    action: selected.action,
    language,
    criteria: resolved.criteria,
    contextUse: resolved.contextUse,
    missingCriteria: selected.missingCriteria,
    reason: selected.reason,
    confidence: selected.confidence,
    replyInstruction: selected.replyInstruction,
  };

  return {
    decision,
    resolved,
    matchingProperties,
    cityAlternatives,
    searchCriteria,
  };
}
