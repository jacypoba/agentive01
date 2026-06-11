import type { SupportedLanguage } from "@/lib/i18n/types";

export type ConversationAction =
  | "ask_clarifying_question"
  | "show_properties"
  | "show_city_alternatives"
  | "answer_general_question"
  | "schedule_visit"
  | "handoff"
  | "no_match";

export type DecisionConfidence = "high" | "medium" | "low";

export type CriteriaField =
  | "city"
  | "neighborhood"
  | "budget"
  | "propertyType"
  | "buyRentIntent";

export type DecisionSearchCriteria = {
  city: string | null;
  neighborhood: string | null;
  budget: number | null;
  propertyType: string | null;
  buyRentIntent: "buy" | "rent" | null;
};

export type DecisionContextUse = {
  usedPendingOffer: boolean;
  userOverrodePendingOffer: boolean;
  usedLeadMemory: boolean;
};

export type ReplyInstruction =
  | {
      kind: "deterministic";
      template:
        | "recommendation_intro"
        | "city_alternative_offer"
        | "no_match"
        | "qualifying_question"
        | "closing"
        | "general";
    }
  | {
      kind: "llm";
      topic: "general" | "visit" | "qualification";
    };

export type ConversationDecision = {
  action: ConversationAction;
  language: SupportedLanguage;
  criteria: DecisionSearchCriteria;
  contextUse: DecisionContextUse;
  missingCriteria: CriteriaField[];
  reason: string;
  confidence: DecisionConfidence;
  replyInstruction: ReplyInstruction;
};

export type InventorySummary = {
  matchCount: number;
  alternativeCities: string[];
  criteriaMissing: boolean;
};

export type BuildConversationDecisionShadowInput = {
  latestMessage: string;
  history: import("@/types/database").Conversation[];
  lead: import("@/types/database").Lead;
  pendingPropertyOffer: import("@/types/database").PendingPropertyOffer | null;
  language: SupportedLanguage;
  inventorySummary: InventorySummary;
};

export type ConversationDecisionShadowDiff = {
  intentVsAction: {
    currentIntent: string;
    shadowAction: ConversationAction;
    matches: boolean;
  };
  city: {
    current: string | null;
    shadow: string | null;
    matches: boolean;
  };
  neighborhood: {
    current: string | null;
    shadow: string | null;
    matches: boolean;
  };
  propertyType: {
    current: string | null;
    shadow: string | null;
    matches: boolean;
  };
};

export type ConversationDecisionShadowLog = {
  leadId: string;
  latestMessagePreview: string;
  currentFlowIntent: string;
  decision: ConversationDecision;
  differences: ConversationDecisionShadowDiff;
};
