import {
  clientAskedToSeeOptions,
  lastClientMessageMentionsVisit,
} from "@/lib/ai/qualification";
import type { Conversation } from "@/types/database";
import type {
  ConversationAction,
  CriteriaField,
  DecisionConfidence,
  DecisionSearchCriteria,
  InventorySummary,
  ReplyInstruction,
} from "./types";
import type { ResolvedCriteriaShadow } from "./resolve-criteria-shadow";
import {
  hasResolvedPropertySearchCriteria,
  isPropertySearchMessage,
  PROPERTY_TYPE_PATTERN,
} from "./property-search-signals";

const GENERAL_QUESTION_PATTERN =
  /\?|^(como|quando|onde|quanto|qual|quais|o que|what|how|when|where|why|come|dove|quale|qué|que|pode|podes|puoi|puedes)\b/i;

const HANDOFF_PATTERN =
  /\b(falar com|humano|agente|consultor|persona|person|human|speak to|talk to|parler avec)\b/i;

const EN_PROPERTY_SEARCH_VERB_PATTERN =
  /\b(looking for|searching for|i['']m looking|i am looking|want to buy|looking to buy)\b/i;

const OTHER_LANG_PROPERTY_SEARCH_VERB_PATTERN =
  /\b(procuro|procurar|procura|quero|preciso|cerco|cercare|voglio|quiero|busco|buscar|je cherche|je souhaite|je veux|acheter|souhaite)\b/i;

function computeMissingCriteria(
  criteria: DecisionSearchCriteria,
  latestMessage: string
): CriteriaField[] {
  const missing: CriteriaField[] = [];

  if (!criteria.city) missing.push("city");
  if (!criteria.propertyType && !PROPERTY_TYPE_PATTERN.test(latestMessage)) {
    missing.push("propertyType");
  }
  if (criteria.budget == null) missing.push("budget");
  if (!criteria.buyRentIntent) missing.push("buyRentIntent");

  return missing;
}

function isBroadSearch(criteria: DecisionSearchCriteria): boolean {
  return (
    criteria.city != null &&
    criteria.budget == null &&
    criteria.neighborhood == null
  );
}

function isPropertyCityPivot(resolved: ResolvedCriteriaShadow): boolean {
  return (
    resolved.contextUse.userOverrodePendingOffer || resolved.pendingOfferRejected
  );
}

function isEnglishPropertySearchBrief(
  criteria: DecisionSearchCriteria,
  latestMessage: string
): boolean {
  if (
    !Boolean(criteria.city?.trim()) ||
    !Boolean(criteria.propertyType?.trim()) ||
    !isPropertySearchMessage(latestMessage)
  ) {
    return false;
  }

  if (!EN_PROPERTY_SEARCH_VERB_PATTERN.test(latestMessage)) {
    return false;
  }

  if (OTHER_LANG_PROPERTY_SEARCH_VERB_PATTERN.test(latestMessage)) {
    return false;
  }

  return true;
}

function hasCompleteSearchBrief(
  criteria: DecisionSearchCriteria,
  latestMessage: string
): boolean {
  if (
    Boolean(criteria.city?.trim()) &&
    Boolean(criteria.propertyType?.trim()) &&
    criteria.buyRentIntent != null
  ) {
    return true;
  }

  return isEnglishPropertySearchBrief(criteria, latestMessage);
}

function skipBroadQualification(
  criteria: DecisionSearchCriteria,
  resolved: ResolvedCriteriaShadow,
  pendingOfferAccepted: boolean,
  history: Conversation[],
  latestMessage: string
): boolean {
  return (
    pendingOfferAccepted ||
    (isPropertyCityPivot(resolved) && criteria.city != null) ||
    clientAskedToSeeOptions(history) ||
    hasCompleteSearchBrief(criteria, latestMessage)
  );
}

export type SelectedActionShadow = {
  action: ConversationAction;
  reason: string;
  confidence: DecisionConfidence;
  replyInstruction: ReplyInstruction;
  missingCriteria: CriteriaField[];
};

export function selectActionShadow(
  latestMessage: string,
  history: Conversation[],
  resolved: ResolvedCriteriaShadow,
  inventorySummary: InventorySummary
): SelectedActionShadow {
  const { criteria, contextUse, pendingOfferAccepted } = resolved;
  const missingCriteria = computeMissingCriteria(criteria, latestMessage);

  if (HANDOFF_PATTERN.test(latestMessage)) {
    return {
      action: "handoff",
      reason: "explicit_handoff_request",
      confidence: "high",
      replyInstruction: { kind: "llm", topic: "general" },
      missingCriteria,
    };
  }

  if (lastClientMessageMentionsVisit(history)) {
    return {
      action: "schedule_visit",
      reason: "visit_intent_detected",
      confidence: "high",
      replyInstruction: { kind: "llm", topic: "visit" },
      missingCriteria,
    };
  }

  if (
    GENERAL_QUESTION_PATTERN.test(latestMessage) &&
    !isPropertySearchMessage(latestMessage) &&
    !pendingOfferAccepted &&
    !isPropertyCityPivot(resolved)
  ) {
    return {
      action: "answer_general_question",
      reason: "general_question",
      confidence: "medium",
      replyInstruction: { kind: "llm", topic: "general" },
      missingCriteria,
    };
  }

  const hasSearchIntent =
    isPropertySearchMessage(latestMessage) ||
    pendingOfferAccepted ||
    contextUse.userOverrodePendingOffer ||
    hasResolvedPropertySearchCriteria(criteria);

  if (hasSearchIntent || criteria.city) {
    if (inventorySummary.matchCount > 0) {
      if (
        isBroadSearch(criteria) &&
        !skipBroadQualification(
          criteria,
          resolved,
          pendingOfferAccepted,
          history,
          latestMessage
        )
      ) {
        return {
          action: "ask_clarifying_question",
          reason: "broad_search_needs_qualification",
          confidence: "high",
          replyInstruction: {
            kind: "deterministic",
            template: "qualifying_question",
          },
          missingCriteria,
        };
      }

      return {
        action: "show_properties",
        reason: pendingOfferAccepted
          ? "pending_offer_accepted_with_inventory"
          : "criteria_match_inventory",
        confidence: "high",
        replyInstruction: {
          kind: "deterministic",
          template: "recommendation_intro",
        },
        missingCriteria,
      };
    }

    if (inventorySummary.alternativeCities.length > 0) {
      return {
        action: "show_city_alternatives",
        reason: "zero_match_with_alternative_cities",
        confidence: "high",
        replyInstruction: {
          kind: "deterministic",
          template: "city_alternative_offer",
        },
        missingCriteria,
      };
    }

    if (
      isPropertySearchMessage(latestMessage) ||
      pendingOfferAccepted ||
      contextUse.userOverrodePendingOffer ||
      hasResolvedPropertySearchCriteria(criteria)
    ) {
      if (
        isBroadSearch(criteria) &&
        !skipBroadQualification(
          criteria,
          resolved,
          pendingOfferAccepted,
          history,
          latestMessage
        )
      ) {
        return {
          action: "ask_clarifying_question",
          reason: "broad_search_no_inventory",
          confidence: "medium",
          replyInstruction: {
            kind: "deterministic",
            template: "qualifying_question",
          },
          missingCriteria,
        };
      }

      return {
        action: "no_match",
        reason: "zero_match_no_alternatives",
        confidence: "high",
        replyInstruction: { kind: "deterministic", template: "no_match" },
        missingCriteria,
      };
    }
  }

  if (pendingOfferAccepted && criteria.city) {
    return {
      action: inventorySummary.matchCount > 0 ? "show_properties" : "no_match",
      reason:
        inventorySummary.matchCount > 0
          ? "pending_offer_accepted_with_inventory"
          : "pending_offer_accepted_no_inventory",
      confidence: "high",
      replyInstruction: {
        kind: "deterministic",
        template:
          inventorySummary.matchCount > 0 ? "recommendation_intro" : "no_match",
      },
      missingCriteria,
    };
  }

  return {
    action: "answer_general_question",
    reason: "no_clear_property_intent",
    confidence: "low",
    replyInstruction: { kind: "llm", topic: "general" },
    missingCriteria,
  };
}

/** Pivot-aware action selection for Phase B2 cutover. */
export function selectActionShadowForPivot(
  latestMessage: string,
  resolved: ResolvedCriteriaShadow,
  inventorySummary: InventorySummary
): SelectedActionShadow {
  const { criteria, pendingOfferAccepted } = resolved;
  const missingCriteria = computeMissingCriteria(criteria, latestMessage);

  if (!criteria.propertyType?.trim()) {
    return {
      action: "ask_clarifying_question",
      reason: "pivot_missing_property_type",
      confidence: "high",
      replyInstruction: {
        kind: "deterministic",
        template: "qualifying_question",
      },
      missingCriteria,
    };
  }

  if (inventorySummary.matchCount > 0) {
    return {
      action: "show_properties",
      reason: pendingOfferAccepted
        ? "pending_offer_accepted_with_inventory"
        : "pivot_city_match_inventory",
      confidence: "high",
      replyInstruction: {
        kind: "deterministic",
        template: "recommendation_intro",
      },
      missingCriteria,
    };
  }

  if (inventorySummary.alternativeCities.length > 0) {
    return {
      action: "show_city_alternatives",
      reason: "pivot_zero_match_with_alternative_cities",
      confidence: "high",
      replyInstruction: {
        kind: "deterministic",
        template: "city_alternative_offer",
      },
      missingCriteria,
    };
  }

  return {
    action: "no_match",
    reason: "pivot_zero_match_no_alternatives",
    confidence: "high",
    replyInstruction: { kind: "deterministic", template: "no_match" },
    missingCriteria,
  };
}
