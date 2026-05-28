import type { Conversation, Lead } from "@/types/database";
import {
  getRecentAiTexts,
  isNearDuplicateReply,
  normalizeForDedupe,
  pickUnusedVariant,
} from "@/lib/ai/dedupe-reply";
import type { ClassifiedIntent, MessageIntent } from "@/lib/ai/intent-classifier";

const CLOSING_REPLY_MARKERS = [
  "fico por aqui",
  "é só chamar",
  "se precisar de mais alguma coisa",
];

export const CLOSING_REPLY_VARIANTS = [
  "Perfeito 👌 Fico por aqui então. Se precisar de mais alguma coisa, é só chamar.",
  "Combinado 👌 Qualquer coisa, estou por aqui.",
  "Ótimo — fico à disposição se precisar.",
];

export const BANNED_WITHOUT_FRESH_QUERY = [
  /por agora estas são as melhores/i,
  /se entrar algo novo, aviso/i,
  /não tenho mais opções/i,
  /não há mais imóveis/i,
];

export const BANNED_ON_THANKS = [
  /se entrar algo novo/i,
  /por agora estas são as melhores/i,
  /tenho mais opções/i,
  /visita/i,
];

export function alreadySentClosingRecently(history: Conversation[]): boolean {
  const recent = getRecentAiTexts(history, 4);
  return recent.some((text) =>
    CLOSING_REPLY_MARKERS.some((marker) => text.includes(marker))
  );
}

export function buildClosingReply(lead: Lead, history: Conversation[]): string | null {
  if (alreadySentClosingRecently(history)) {
    return null;
  }

  const reply = pickUnusedVariant(
    CLOSING_REPLY_VARIANTS,
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
    return BANNED_ON_THANKS.some((pattern) => pattern.test(trimmed));
  }

  if (!context.freshQueryMade && !context.propertiesSent) {
    if (BANNED_WITHOUT_FRESH_QUERY.some((pattern) => pattern.test(trimmed))) {
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

  return trimmed;
}

export function intentLabel(intent: ClassifiedIntent): string {
  return intent.intent;
}

export function logIntentDecision(
  leadId: string,
  classified: ClassifiedIntent
): void {
  console.log("[WhatsApp guardrails] Intent classified", {
    leadId,
    intent: classified.intent,
    wantsReshow: classified.wantsReshow,
    wantsMore: classified.wantsMore,
    preview: classified.latestMessage.slice(0, 80),
  });
}
