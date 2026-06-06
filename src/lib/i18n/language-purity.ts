import type { SupportedLanguage } from "@/lib/i18n/types";
import { completeLanguageRecord } from "@/lib/i18n/types";
import {
  getConsultantLanguageFallback,
  validateReplyLanguage,
} from "@/lib/i18n/reply-language";

const FOREIGN_MARKERS = completeLanguageRecord<RegExp[]>({
  pt: [
    /\b(perfecto|qued[oó]|agendada|gracias|hola|buenos d[ií]as|busco|cu[aá]l|ma[nñ]ana)\b/i,
    /\b(grazie|ciao|buongiorno|buonasera|perfetto|cerco|domani)\b/i,
    /\b(thanks|thank you|hello|hey\b|looking for|perfect\b|tomorrow)\b/i,
    /\b(merci|bonjour|je cherche|parfait|demain)\b/i,
  ],
  en: [
    /\b(perfeito|obrigad[oa]|ol[aá]|ficou|marcad[oa]|segunda-feira|im[oó]vel|amanh[aã])\b/i,
    /\b(grazie|ciao|buongiorno|perfetto|cerco|domani)\b/i,
    /\b(gracias|hola|perfecto|busco|ma[nñ]ana|qued[oó])\b/i,
    /\b(merci|bonjour|je cherche|parfait)\b/i,
    /[ãõç]/i,
  ],
  it: [
    /\b(perfeito|obrigad[oa]|ol[aá]|ficou|segunda-feira|im[oó]vel)\b/i,
    /\b(gracias|hola|perfecto|busco|qued[oó]|agendada)\b/i,
    /\b(thanks|hello|looking for|perfect\b)\b/i,
    /\b(merci|bonjour|je cherche)\b/i,
    /[ãõç]/i,
  ],
  es: [
    /\b(perfeito|obrigad[oa]|ol[aá]|ficou|marcad[oa]|segunda-feira|im[oó]vel|amanh[aã])\b/i,
    /\b(grazie|ciao|buongiorno|perfetto|cerco|domani)\b/i,
    /\b(thanks|thank you|hello|looking for)\b/i,
    /\b(merci|bonjour|je cherche)\b/i,
    /[ãõç]/i,
  ],
});

const SAFE_MONOLINGUAL_FALLBACK = completeLanguageRecord({
  pt: "Claro — já vejo o que encaixa nesse perfil.",
  en: "Sure — I'll check what fits your criteria.",
  it: "Certo — guardo cosa c'è in quella fascia.",
  es: "Claro — miro opciones en ese rango.",
  fr: "Bien sûr — je regarde ce qui correspond à vos critères.",
});

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
): { text: string; adjusted: boolean; reason?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: trimmed, adjusted: false };
  }

  const validation = validateReplyLanguage(trimmed, language);
  if (validation.valid) {
    return { text: trimmed, adjusted: false };
  }

  const fallback = getConsultantLanguageFallback(language);
  return {
    text: fallback,
    adjusted: true,
    reason: validation.reason,
  };
}

export function getMonolingualFallback(language: SupportedLanguage): string {
  return SAFE_MONOLINGUAL_FALLBACK[language];
}
