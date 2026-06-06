export type SupportedLanguage = "pt" | "en" | "it" | "es" | "fr";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "pt",
  "en",
  "it",
  "es",
  "fr",
];

export const DEFAULT_LANGUAGE: SupportedLanguage = "pt";

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return (
    value === "pt" ||
    value === "en" ||
    value === "it" ||
    value === "es" ||
    value === "fr"
  );
}

export function normalizeLanguage(
  value: string | null | undefined,
  fallback: SupportedLanguage = DEFAULT_LANGUAGE
): SupportedLanguage {
  return isSupportedLanguage(value) ? value : fallback;
}

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  pt: "Portuguese",
  en: "English",
  it: "Italian",
  es: "Spanish",
  fr: "French",
};

export const LANGUAGE_BADGES: Record<SupportedLanguage, string> = {
  pt: "PT",
  en: "EN",
  it: "IT",
  es: "ES",
  fr: "FR",
};

export const LANGUAGE_LOCALES: Record<SupportedLanguage, string> = {
  pt: "pt-PT",
  en: "en-GB",
  it: "it-IT",
  es: "es-ES",
  fr: "fr-FR",
};

export function getLanguageBadge(language: SupportedLanguage): string {
  return LANGUAGE_BADGES[language];
}

export function getLanguageLabel(language: SupportedLanguage): string {
  return LANGUAGE_LABELS[language];
}

export function getLanguageLocale(language: SupportedLanguage): string {
  return LANGUAGE_LOCALES[language];
}

/** Fill French from English until dedicated FR copy exists. */
export function completeLanguageRecord<T>(base: {
  pt: T;
  en: T;
  it: T;
  es: T;
  fr?: T;
}): Record<SupportedLanguage, T> {
  return {
    pt: base.pt,
    en: base.en,
    it: base.it,
    es: base.es,
    fr: base.fr ?? base.en,
  };
}
