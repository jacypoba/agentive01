import { completeLanguageRecord, type SupportedLanguage } from "@/lib/i18n/types";

export const CONVERSATIONAL_OPENERS = completeLanguageRecord({
  pt: ["Entendo", "Claro", "Perfeito"],
  it: ["Capisco", "Certo", "Perfetto"],
  en: ["I understand", "Sure", "Of course"],
  es: ["Entiendo", "Claro", "Perfecto"],
  fr: ["Je comprends", "Bien sûr", "Parfait"],
});

export type OpenerStyle = "none" | "comma" | "period";

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

export function pickOpenerStyle(seed: string): OpenerStyle {
  const bucket = hashSeed(`${seed}:style`) % 10;
  if (bucket < 4) {
    return "none";
  }
  if (bucket < 7) {
    return "period";
  }
  return "comma";
}

export function pickConversationalOpener(
  language: SupportedLanguage,
  seed: string
): string {
  const openers = CONVERSATIONAL_OPENERS[language];
  return openers[hashSeed(`${seed}:opener`) % openers.length]!;
}

function capitalizeFirst(text: string): string {
  if (!text) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowercaseFirst(text: string): string {
  if (!text) {
    return text;
  }
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

export function startsWithConversationalOpener(
  text: string,
  language: SupportedLanguage
): boolean {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return CONVERSATIONAL_OPENERS[language].some((opener) => {
    const openerLower = opener.toLowerCase();
    return (
      lower.startsWith(`${openerLower},`) ||
      lower.startsWith(`${openerLower}.`) ||
      lower.startsWith(`${openerLower} —`) ||
      lower.startsWith(`${openerLower} –`) ||
      lower.startsWith(`${openerLower} -`)
    );
  });
}

/** Rewrite legacy "Opener — body" into comma/period/none style. */
export function normalizeLegacyEmDashOpeners(
  text: string,
  language: SupportedLanguage,
  seed: string
): string {
  const trimmed = text.trim();
  for (const opener of CONVERSATIONAL_OPENERS[language]) {
    const pattern = new RegExp(
      `^${escapeRegExp(opener)}\\s*[—–-]\\s*`,
      "iu"
    );
    if (pattern.test(trimmed)) {
      const body = trimmed.replace(pattern, "").trim();
      return withConversationalOpener(body, language, `${seed}:legacy`);
    }
  }
  return trimmed;
}

export function withConversationalOpener(
  text: string,
  language: SupportedLanguage,
  seed: string
): string {
  const body = text.trim();
  if (!body) {
    return body;
  }

  if (startsWithConversationalOpener(body, language)) {
    return body;
  }

  const style = pickOpenerStyle(seed);
  if (style === "none") {
    return capitalizeFirst(body);
  }

  const opener = pickConversationalOpener(language, seed);

  if (style === "comma") {
    return `${opener}, ${lowercaseFirst(body)}`;
  }

  return `${opener}. ${capitalizeFirst(body)}`;
}

export function polishConversationalReply(
  text: string,
  language: SupportedLanguage,
  seed = "polish"
): string {
  const withoutLegacyDash = normalizeLegacyEmDashOpeners(text, language, seed);
  const chained = reduceQuestionChaining(withoutLegacyDash, language);
  return normalizeConversationalPunctuation(chained, language);
}
