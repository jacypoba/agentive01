import type { SupportedLanguage } from "@/lib/i18n/types";
import { resolveCriteriaShadow } from "./resolve-criteria-shadow";
import { selectActionShadow } from "./select-action-shadow";
import type {
  BuildConversationDecisionShadowInput,
  ConversationDecision,
} from "./types";

export function buildConversationDecisionShadow(
  input: BuildConversationDecisionShadowInput
): ConversationDecision {
  const {
    latestMessage,
    history,
    lead,
    pendingPropertyOffer,
    language,
    inventorySummary,
  } = input;

  const resolved = resolveCriteriaShadow(
    latestMessage,
    lead,
    pendingPropertyOffer,
    history
  );
  const selected = selectActionShadow(
    latestMessage,
    history,
    resolved,
    inventorySummary
  );

  return {
    action: selected.action,
    language,
    criteria: resolved.criteria,
    contextUse: resolved.contextUse,
    missingCriteria: selected.missingCriteria,
    reason: selected.reason,
    confidence: selected.confidence,
    replyInstruction: selected.replyInstruction,
  };
}

export function isConversationDecisionShadowEnabled(): boolean {
  const flag = process.env.CONVERSATION_DECISION_ENGINE_SHADOW?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") {
    return false;
  }
  return true;
}

export type { SupportedLanguage };
