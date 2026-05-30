import {
  detectLanguageWithConfidence,
  type LanguageDetectionResult,
} from "@/lib/i18n/detect-language";
import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/lib/i18n/types";

const EXPLICIT_LANGUAGE_SWITCH: { language: SupportedLanguage; pattern: RegExp }[] = [
  { language: "en", pattern: /\b(in english|speak english|english please|reply in english)\b/i },
  {
    language: "pt",
    pattern: /\b(em portugu[eê]s|in portuguese|portugu[eê]s por favor|fala portugu[eê]s)\b/i,
  },
  {
    language: "it",
    pattern: /\b(in italiano|speak italian|italiano per favore|rispondi in italiano)\b/i,
  },
  {
    language: "es",
    pattern: /\b(en espa[nñ]ol|in spanish|espa[nñ]ol por favor|habla espa[nñ]ol)\b/i,
  },
];

const AMBIGUOUS_ONLY = /^(ok|okay|k|sim|s[ií]|no|n[aã]o|yes|yep|yeah|👍|👌|🙂|😊|\.+|!+|\?+)+$/iu;

/**
 * Single source of truth for outbound WhatsApp language.
 * Uses ONLY the latest user message (+ explicit switch requests).
 * Falls back to lead preferred_language when the latest message is ambiguous.
 */
export function resolveConversationLanguage(input: {
  latestMessage: string;
  leadPreferred?: string | null;
}): SupportedLanguage {
  const stored = normalizeLanguage(input.leadPreferred);
  const trimmed = input.latestMessage.trim();

  const explicit = detectExplicitLanguageSwitch(trimmed);
  if (explicit) {
    return explicit;
  }

  if (!trimmed || isAmbiguousMessage(trimmed)) {
    return stored;
  }

  const detection = detectLanguageWithConfidence(trimmed, stored);
  if (detection.confident || (detection.scores[detection.language] ?? 0) >= 2) {
    return detection.language;
  }

  return stored;
}

export function detectExplicitLanguageSwitch(
  text: string
): SupportedLanguage | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  for (const entry of EXPLICIT_LANGUAGE_SWITCH) {
    if (entry.pattern.test(trimmed)) {
      return entry.language;
    }
  }

  return null;
}

export function isAmbiguousMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  if (trimmed.length <= 2) {
    return true;
  }

  if (AMBIGUOUS_ONLY.test(trimmed)) {
    return true;
  }

  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length === 0;
}

export type { LanguageDetectionResult };
