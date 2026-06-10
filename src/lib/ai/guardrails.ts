import type { Conversation, Lead } from "@/types/database";
import {
  getRecentAiTexts,
  isNearDuplicateReply,
  pickUnusedVariant,
} from "@/lib/ai/dedupe-reply";
import type { ClassifiedIntent, MessageIntent } from "@/lib/ai/intent-classifier";
import {
  BANNED_DEFERRAL,
  BANNED_ON_THANKS,
  BANNED_WITHOUT_FRESH_QUERY,
  getClosingMarkers,
  getClosingReplies,
} from "@/lib/i18n/messages";
import { enforceReplyLanguage } from "@/lib/i18n/language-purity";
import { polishConversationalReply } from "@/lib/ai/conversation-quality-v1";
import { finalizeWhatsAppText } from "@/lib/ai/complete-response";
import { getLeadLanguage } from "@/lib/i18n/sync-language";
import type { SupportedLanguage } from "@/lib/i18n/types";

export function alreadySentClosingRecently(
  history: Conversation[],
  language: SupportedLanguage
): boolean {
  const recent = getRecentAiTexts(history, 4);
  const markers = getClosingMarkers(language);
  return recent.some((text) => markers.some((marker) => text.includes(marker)));
}

export function buildClosingReply(
  lead: Lead,
  history: Conversation[],
  language: SupportedLanguage = getLeadLanguage(lead)
): string | null {
  if (alreadySentClosingRecently(history, language)) {
    return null;
  }

  const reply = pickUnusedVariant(
    getClosingReplies(language),
    history,
    `${lead.id}:closing`
  );

  if (!reply || isNearDuplicateReply(reply, history)) {
    return null;
  }

  return reply;
}

export type ReplyGuardContext = {
  intent: MessageIntent;
  freshQueryMade: boolean;
  propertiesSent: boolean;
  language: SupportedLanguage;
};

export function violatesReplyGuardrails(
  text: string,
  context: ReplyGuardContext
): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  if (context.intent === "thanks_or_closing") {
    return BANNED_ON_THANKS[context.language].some((pattern) =>
      pattern.test(trimmed)
    );
  }

  if (
    context.propertiesSent ||
    context.intent === "property_search" ||
    context.intent === "ask_more_options" ||
    context.intent === "accept_pending_offer"
  ) {
    if (
      BANNED_DEFERRAL[context.language].some((pattern) => pattern.test(trimmed))
    ) {
      return true;
    }
  }

  if (!context.freshQueryMade && !context.propertiesSent) {
    if (
      BANNED_WITHOUT_FRESH_QUERY[context.language].some((pattern) =>
        pattern.test(trimmed)
      )
    ) {
      return true;
    }
  }

  return false;
}

export function sanitizeGuardedReply(
  text: string,
  history: Conversation[],
  context: ReplyGuardContext
): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (violatesReplyGuardrails(trimmed, context)) {
    return null;
  }

  if (isNearDuplicateReply(trimmed, history)) {
    return null;
  }

  const { text: pureText, adjusted } = enforceReplyLanguage(trimmed, context.language);
  if (adjusted) {
    console.log("[WhatsApp guardrails] Replaced mixed-language reply", {
      language: context.language,
      preview: trimmed.slice(0, 80),
    });
  }

  const finalized = finalizeWhatsAppText(pureText);
  if (!finalized) {
    console.log("[WhatsApp guardrails] Blocked incomplete reply", {
      preview: pureText.slice(0, 80),
    });
    return null;
  }

  return polishConversationalReply(finalized, context.language);
}

export function logIntentDecision(
  leadId: string,
  classified: ClassifiedIntent,
  language: SupportedLanguage
): void {
  console.log("[WhatsApp guardrails] Intent classified", {
    leadId,
    intent: classified.intent,
    language,
    wantsReshow: classified.wantsReshow,
    wantsMore: classified.wantsMore,
    preview: classified.latestMessage.slice(0, 80),
  });
}
