import { emptyLanguageScores } from "@/lib/i18n/detect-language";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n/types";

/** Strong lexical signals for a lead's very first substantive message. */
export const FIRST_MESSAGE_LANGUAGE_PATTERNS: Record<
  SupportedLanguage,
  RegExp[]
> = {
  it: [
    /\bvorrei\b/i,
    /\bcerco\b/i,
    /\bappartamento\b/i,
    /\bcasa\b/i,
    /\bacquistare\b/i,
    /\bcomprare\b/i,
    /\bimmobile\b/i,
  ],
  en: [
    /\blooking for\b/i,
    /\bapartment\b/i,
    /\bhouse\b/i,
    /\bproperty\b/i,
    /\bbuy\b/i,
    /\bpurchase\b/i,
  ],
  es: [
    /\bbusco\b/i,
    /\bapartamento\b/i,
    /\bcasa\b/i,
    /\bcomprar\b/i,
    /\bvivienda\b/i,
    /\binmueble\b/i,
  ],
  fr: [
    /\bje cherche\b/i,
    /\bappartement\b/i,
    /\bmaison\b/i,
    /\bacheter\b/i,
    /\bimmobilier\b/i,
    /\bpropri[eé]t[eé]\b/i,
  ],
  pt: [
    /\bprocuro\b/i,
    /\bapartamento\b/i,
    /\bmoradia\b/i,
    /\bcasa\b/i,
    /\bcomprar\b/i,
    /\bim[oó]vel\b/i,
  ],
};

export function detectFirstMessageLanguage(
  text: string
): SupportedLanguage | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const scores = emptyLanguageScores();

  for (const language of SUPPORTED_LANGUAGES) {
    for (const pattern of FIRST_MESSAGE_LANGUAGE_PATTERNS[language]) {
      if (pattern.test(normalized)) {
        scores[language] += 1;
      }
    }
  }

  const ranked = SUPPORTED_LANGUAGES.map((language) => ({
    language,
    score: scores[language],
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.language.localeCompare(b.language));

  if (ranked.length === 0) {
    return null;
  }

  const top = ranked[0]!;
  const second = ranked[1];

  if (second && second.score === top.score) {
    return null;
  }

  return top.language;
}
