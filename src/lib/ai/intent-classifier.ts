import type { Conversation, Lead } from "@/types/database";
import {
  clientAskedForMoreOptions,
  clientAskedToReshowOptions,
  getLastClientMessageText,
  lastClientMessageMentionsVisit,
} from "@/lib/ai/qualification";

export type MessageIntent =
  | "property_search"
  | "ask_more_options"
  | "visit_request"
  | "thanks_or_closing"
  | "general_question"
  | "unknown";

export type ClassifiedIntent = {
  intent: MessageIntent;
  wantsReshow: boolean;
  wantsMore: boolean;
  latestMessage: string;
};

const THANKS_CLOSING_PATTERN =
  /\b(obrigad[oa]|obg|thanks|thank you|thx|agradeço|agradecido|valeu)\b/i;

const CLOSING_ONLY_PATTERN =
  /^(est[aá]\s+bem|tudo\s+bem|ok|okay|perfeito|combinado|sem\s+problema|fico\s+por\s+aqui|at[eé]\s+(logo|j[aá]|breve)|adeus|boa\s+(tarde|noite|sorte))[\s,!.👌🙂]*$/i;

const PROPERTY_SEARCH_PATTERN =
  /\b(procuro|procurar|procura|quero|preciso|interess(?:a|o)|busco|pesquiso|looking for|searching for)\b/i;

const PROPERTY_TYPE_IN_MESSAGE =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|studio|house|apartment|flat|villa|t[0-4])\b/i;

const CITY_OR_BUDGET_SIGNAL =
  /\b(em\s+[a-zà-ú]|lisboa|porto|milano|milan|firenze|florence|roma|cascais|sintra|oeiras|faro|coimbra|braga|até|orçamento|budget|€|\d[\d.,\s]*(mil|k|milhões?))\b/i;

const GENERAL_QUESTION_PATTERN =
  /\?|^(como|quando|onde|quanto|qual|quais|o que|what|how|when|where|why|pode|podes|consegue)\b/i;

const ACTIVE_REQUEST_PATTERN =
  /\b(mostra|mostrar|opções|opcões|imóveis|imoveis|visita|visitar|agendar|marcar|procuro|procura|quero ver|reenvi|mais opções|tem mais|tens mais)\b/i;

function getLatestClientText(history: Conversation[]): string {
  return getLastClientMessageText(history)?.trim() ?? "";
}

function isPureThanksOrClosing(text: string): boolean {
  if (!text || text.length > 120) {
    return false;
  }

  if (ACTIVE_REQUEST_PATTERN.test(text)) {
    return false;
  }

  if (CLOSING_ONLY_PATTERN.test(text)) {
    return true;
  }

  if (THANKS_CLOSING_PATTERN.test(text) && text.length <= 80) {
    if (PROPERTY_TYPE_IN_MESSAGE.test(text) || CITY_OR_BUDGET_SIGNAL.test(text)) {
      return false;
    }
    return true;
  }

  if (/^est[aá]\s+bem[,.\s]+obrigad/i.test(text)) {
    return true;
  }

  return false;
}

function isPropertySearchMessage(text: string): boolean {
  if (!text) {
    return false;
  }

  const hasSearchVerb = PROPERTY_SEARCH_PATTERN.test(text);
  const hasType = PROPERTY_TYPE_IN_MESSAGE.test(text);
  const hasLocationOrBudget = CITY_OR_BUDGET_SIGNAL.test(text);

  return hasSearchVerb && (hasType || hasLocationOrBudget);
}

function isGeneralQuestion(text: string): boolean {
  if (!text) {
    return false;
  }
  return GENERAL_QUESTION_PATTERN.test(text) && !isPropertySearchMessage(text);
}

/**
 * Deterministic intent for the latest client message — evaluated before AI/property logic.
 */
export function classifyMessageIntent(
  history: Conversation[],
  _lead?: Lead
): ClassifiedIntent {
  const latestMessage = getLatestClientText(history);
  const wantsReshow = clientAskedToReshowOptions(history);
  const wantsMore = clientAskedForMoreOptions(history);

  if (wantsReshow || wantsMore) {
    return {
      intent: "ask_more_options",
      wantsReshow,
      wantsMore,
      latestMessage,
    };
  }

  if (isPureThanksOrClosing(latestMessage)) {
    return {
      intent: "thanks_or_closing",
      wantsReshow: false,
      wantsMore: false,
      latestMessage,
    };
  }

  if (lastClientMessageMentionsVisit(history)) {
    return {
      intent: "visit_request",
      wantsReshow: false,
      wantsMore: false,
      latestMessage,
    };
  }

  if (isPropertySearchMessage(latestMessage)) {
    return {
      intent: "property_search",
      wantsReshow: false,
      wantsMore: false,
      latestMessage,
    };
  }

  if (isGeneralQuestion(latestMessage)) {
    return {
      intent: "general_question",
      wantsReshow: false,
      wantsMore: false,
      latestMessage,
    };
  }

  return {
    intent: "unknown",
    wantsReshow: false,
    wantsMore: false,
    latestMessage,
  };
}

export function shouldQueryProperties(intent: ClassifiedIntent): boolean {
  return (
    intent.intent === "property_search" || intent.intent === "ask_more_options"
  );
}

export function shouldUseReshowBatch(intent: ClassifiedIntent): boolean {
  return intent.intent === "ask_more_options" && intent.wantsReshow;
}

export function shouldRunFreshPropertyQuery(intent: ClassifiedIntent): boolean {
  return (
    intent.intent === "property_search" ||
    (intent.intent === "ask_more_options" && intent.wantsMore)
  );
}
