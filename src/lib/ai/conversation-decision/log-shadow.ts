import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import {
  buildPropertyRecommendationGateCriteria,
  type PropertyRecommendationGateCriteria,
} from "@/lib/properties/recommendation-gate";
import type { NormalizedPropertySearch } from "@/lib/properties/normalize-search";
import type { Lead, PendingPropertyOffer } from "@/types/database";
import type { Conversation } from "@/types/database";
import type {
  ConversationDecision,
  ConversationDecisionShadowDiff,
  ConversationDecisionShadowLog,
} from "./types";

function fold(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function valuesMatch(
  current: string | null | undefined,
  shadow: string | null | undefined
): boolean {
  return fold(current) === fold(shadow);
}

export function mapIntentToExpectedAction(
  intent: ClassifiedIntent["intent"],
  hasProperties: boolean,
  hasCityAlternatives: boolean,
  gateBlocked: boolean
): string {
  switch (intent) {
    case "accept_pending_offer":
      return hasProperties ? "show_properties" : "no_match";
    case "property_search":
      if (gateBlocked) return "ask_clarifying_question";
      if (hasProperties) return "show_properties";
      if (hasCityAlternatives) return "show_city_alternatives";
      return "no_match";
    case "ask_more_options":
      return hasProperties ? "show_properties" : "no_match";
    case "visit_request":
      return "schedule_visit";
    case "general_question":
      return "answer_general_question";
    case "thanks_or_closing":
      return "answer_general_question";
    case "unknown":
      return "answer_general_question";
    default:
      return "answer_general_question";
  }
}

export function buildShadowDiff(input: {
  classified: ClassifiedIntent;
  decision: ConversationDecision;
  currentCriteria: PropertyRecommendationGateCriteria;
  hasProperties: boolean;
  hasCityAlternatives: boolean;
  gateBlocked: boolean;
}): ConversationDecisionShadowDiff {
  const expectedAction = mapIntentToExpectedAction(
    input.classified.intent,
    input.hasProperties,
    input.hasCityAlternatives,
    input.gateBlocked
  );

  return {
    intentVsAction: {
      currentIntent: input.classified.intent,
      shadowAction: input.decision.action,
      matches: expectedAction === input.decision.action,
    },
    city: {
      current: input.currentCriteria.city,
      shadow: input.decision.criteria.city,
      matches: valuesMatch(input.currentCriteria.city, input.decision.criteria.city),
    },
    neighborhood: {
      current: input.currentCriteria.neighborhood,
      shadow: input.decision.criteria.neighborhood,
      matches: valuesMatch(
        input.currentCriteria.neighborhood,
        input.decision.criteria.neighborhood
      ),
    },
    propertyType: {
      current: input.currentCriteria.propertyType,
      shadow: input.decision.criteria.propertyType,
      matches: valuesMatch(
        input.currentCriteria.propertyType,
        input.decision.criteria.propertyType
      ),
    },
  };
}

export function buildCurrentFlowCriteria(
  lead: Lead,
  history: Conversation[],
  searchDebug: NormalizedPropertySearch,
  pendingOffer: PendingPropertyOffer | null,
  classifiedIntent: ClassifiedIntent["intent"]
): PropertyRecommendationGateCriteria {
  const base = buildPropertyRecommendationGateCriteria(lead, history, searchDebug);

  if (classifiedIntent === "accept_pending_offer" && pendingOffer) {
    return {
      ...base,
      city: pendingOffer.offeredCity,
      propertyType: pendingOffer.propertyType ?? base.propertyType,
      neighborhood:
        pendingOffer.offeredAreas.length === 1
          ? (pendingOffer.offeredAreas[0] ?? base.neighborhood)
          : base.neighborhood,
      budget: pendingOffer.maxBudget ?? base.budget,
    };
  }

  return base;
}

export function logConversationDecisionShadow(log: ConversationDecisionShadowLog): void {
  console.log("[Conversation Decision Shadow]", {
    leadId: log.leadId,
    latestMessagePreview: log.latestMessagePreview,
    currentFlowIntent: log.currentFlowIntent,
    decision: log.decision,
    differences: log.differences,
  });
}

export function previewMessage(text: string, maxLength = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}
