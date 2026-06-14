const LANGUAGE_LABELS: Record<string, string> = {
  pt: "Portuguese",
  en: "English",
  it: "Italian",
  es: "Spanish",
  fr: "French",
};

export function preferredLanguageLabel(language: string | null | undefined): string {
  const lang = (language ?? "unknown").toLowerCase();
  return LANGUAGE_LABELS[lang] ?? "Unknown";
}
