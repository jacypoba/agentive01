import type { SupportedLanguage } from "@/lib/i18n/types";

/** Strong markers that should not appear in a monolingual reply for the target language. */
const FOREIGN_MARKERS: Record<SupportedLanguage, RegExp[]> = {
  pt: [
    /\b(perfecto|qued[oó]|agendada|gracias|hola|buenos d[ií]as|busco|cu[aá]l|ma[nñ]ana)\b/i,
    /\b(grazie|ciao|buongiorno|buonasera|perfetto|cerco|domani)\b/i,
    /\b(thanks|thank you|hello|hey\b|looking for|perfect\b|tomorrow)\b/i,
  ],
  en: [
    /\b(perfeito|obrigad[oa]|ol[aá]|ficou|marcad[oa]|segunda-feira|im[oó]vel|amanh[aã])\b/i,
    /\b(grazie|ciao|buongiorno|perfetto|cerco|domani)\b/i,
    /\b(gracias|hola|perfecto|busco|ma[nñ]ana|qued[oó])\b/i,
    /[ãõç]/i,
  ],
  it: [
    /\b(perfeito|obrigad[oa]|ol[aá]|ficou|segunda-feira|im[oó]vel)\b/i,
    /\b(gracias|hola|perfecto|busco|qued[oó]|agendada)\b/i,
    /\b(thanks|hello|looking for|perfect\b)\b/i,
    /[ãõç]/i,
  ],
  es: [
    /\b(perfeito|obrigad[oa]|ol[aá]|ficou|marcad[oa]|segunda-feira|im[oó]vel|amanh[aã])\b/i,
    /\b(grazie|ciao|buongiorno|perfetto|cerco|domani)\b/i,
    /\b(thanks|thank you|hello|looking for)\b/i,
    /[ãõç]/i,
  ],
};

const SAFE_MONOLINGUAL_FALLBACK: Record<SupportedLanguage, string> = {
  pt: "Percebi 👌 Já trato disso.",
  en: "Got it 👌 I'm on it.",
  it: "Capito 👌 Ci penso io.",
  es: "Entendido 👌 Me encargo.",
};

export function hasLanguageMixing(
  text: string,
  expected: SupportedLanguage
): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return FOREIGN_MARKERS[expected].some((pattern) => pattern.test(trimmed));
}

export function enforceReplyLanguage(
  text: string,
  language: SupportedLanguage
): { text: string; adjusted: boolean } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: trimmed, adjusted: false };
  }

  if (!hasLanguageMixing(trimmed, language)) {
    return { text: trimmed, adjusted: false };
  }

  return {
    text: SAFE_MONOLINGUAL_FALLBACK[language],
    adjusted: true,
  };
}

export function getMonolingualFallback(language: SupportedLanguage): string {
  return SAFE_MONOLINGUAL_FALLBACK[language];
}
