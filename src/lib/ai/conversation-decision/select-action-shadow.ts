import { lastClientMessageMentionsVisit } from "@/lib/ai/qualification";
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

const PROPERTY_SEARCH_PATTERN =
  /\b(procuro|procurar|procura|quero|preciso|interess(?:a|o)|busco|pesquiso|looking for|searching for|cerco|cercare|voglio|quiero|buscar)\b/i;

const PROPERTY_TYPE_PATTERN =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|estudio|studio|house|apartment|appartamento|flat|villa|home|casa|villetta|vivienda)\b/i;

const CITY_SIGNAL =
  /\b(em\s+[a-zà-ú]|in\s+[a-z]|en\s+[a-z]|a\s+[a-z]|lisboa|porto|milano|milan|milão|firenze|florence|roma|madrid|paris|london)\b/i;

const GENERAL_QUESTION_PATTERN =
  /\?|^(como|quando|onde|quanto|qual|quais|o que|what|how|when|where|why|come|dove|quale|qué|que|pode|podes|puoi|puedes)\b/i;

const HANDOFF_PATTERN =
  /\b(falar com|humano|agente|consultor|persona|person|human|speak to|talk to|parler avec)\b/i;

function isPropertySearchMessage(text: string): boolean {
  if (!text.trim()) return false;
  const hasSearchVerb = PROPERTY_SEARCH_PATTERN.test(text);
  const hasType = PROPERTY_TYPE_PATTERN.test(text);
  const hasLocation = CITY_SIGNAL.test(text);
  if (hasSearchVerb && (hasType || hasLocation)) return true;
  return hasType && hasLocation;
}

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
    !pendingOfferAccepted
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
    contextUse.userOverrodePendingOffer;

  if (hasSearchIntent || criteria.city) {
    if (inventorySummary.matchCount > 0) {
      if (isBroadSearch(criteria) && !pendingOfferAccepted) {
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
      contextUse.userOverrodePendingOffer
    ) {
      if (isBroadSearch(criteria) && !pendingOfferAccepted) {
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
