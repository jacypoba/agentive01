import { completeLanguageRecord, type SupportedLanguage } from "@/lib/i18n/types";

export const CONVERSATIONAL_OPENERS = completeLanguageRecord({
  pt: ["Entendo", "Claro", "Perfeito"],
  it: ["Capisco", "Certo", "Perfetto"],
  en: ["I understand", "Sure", "Of course"],
  es: ["Entiendo", "Claro", "Perfecto"],
  fr: ["Je comprends", "Bien sûr", "Parfait"],
});

const QUESTION_INDICATORS = completeLanguageRecord({
  pt: [
    /\b(quer|prefere|pode|consegues|gostaria|há|tem|alguma|algum)\b/i,
    /\b(qual|quando|onde|como|quanto)\b/i,
  ],
  en: [
    /\b(would you|do you|can i|could i|should i|want me|any preferred|like me to|like to|want to)\b/i,
    /\b(what|which|when|where|how)\b/i,
  ],
  it: [
    /\b(vuoi|preferisci|puoi|posso|gli|le mostro|quale|quando|dove|come)\b/i,
  ],
  es: [
    /^¿/,
    /\b(quieres|prefieres|puedo|te muestro|alguna|algún)\b/i,
    /\b(qué|cuál|cuando|dónde|cómo)\b/i,
  ],
  fr: [
    /\b(voulez-vous|souhaitez-vous|puis-je|préférez-vous|une zone)\b/i,
    /\b(quel|quelle|quand|où|comment)\b/i,
  ],
});

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickConversationalOpener(
  language: SupportedLanguage,
  seed: string
): string {
  const openers = CONVERSATIONAL_OPENERS[language];
  return openers[hashSeed(seed) % openers.length]!;
}

export function isClearlyQuestion(
  text: string,
  language: SupportedLanguage
): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.endsWith("?") || trimmed.includes("?")) {
    return true;
  }

  if (/^¿/.test(trimmed)) {
    return true;
  }

  return QUESTION_INDICATORS[language].some((pattern) => pattern.test(trimmed));
}

export function normalizeConversationalPunctuation(
  text: string,
  language: SupportedLanguage
): string {
  let trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  trimmed = trimmed.replace(/([.!?…])\1+$/u, "$1");

  const endsWithEmoji =
    /[\p{Emoji_Presentation}\p{Extended_Pictographic}👌🙂😊]$/u.test(trimmed);

  if (isClearlyQuestion(trimmed, language)) {
    if (endsWithEmoji) {
      return trimmed;
    }
    const withoutTerminal = trimmed.replace(/[.!…]+$/u, "").trim();
    if (!withoutTerminal.endsWith("?")) {
      return `${withoutTerminal}?`;
    }
    return trimmed;
  }

  if (!endsWithEmoji && !/[.!?…]$/.test(trimmed)) {
    return `${trimmed}.`;
  }

  return trimmed;
}

/** Drop trailing question stacks — keep the first natural ask. */
export function reduceQuestionChaining(
  text: string,
  language: SupportedLanguage
): string {
  const questionMarks = text.match(/\?/g)?.length ?? 0;
  if (questionMarks <= 1) {
    return text;
  }

  const firstQuestionEnd = text.indexOf("?");
  if (firstQuestionEnd === -1) {
    return text;
  }

  const remainder = text.slice(firstQuestionEnd + 1).trim();
  if (!remainder) {
    return text.slice(0, firstQuestionEnd + 1).trim();
  }

  if (remainder.includes("?") || isClearlyQuestion(remainder, language)) {
    return text.slice(0, firstQuestionEnd + 1).trim();
  }

  return text;
}

export function polishConversationalReply(
  text: string,
  language: SupportedLanguage
): string {
  const chained = reduceQuestionChaining(text, language);
  return normalizeConversationalPunctuation(chained, language);
}

export function startsWithConversationalOpener(
  text: string,
  language: SupportedLanguage
): boolean {
  const lower = text.trim().toLowerCase();
  return CONVERSATIONAL_OPENERS[language].some((opener) =>
    lower.startsWith(opener.toLowerCase())
  );
}

export function withConversationalOpener(
  text: string,
  language: SupportedLanguage,
  seed: string
): string {
  if (startsWithConversationalOpener(text, language)) {
    return text;
  }

  const opener = pickConversationalOpener(language, seed);
  const body = text.trim();
  const lowerFirst =
    body.charAt(0).toLowerCase() + body.slice(1);
  return `${opener} — ${lowerFirst}`;
}
