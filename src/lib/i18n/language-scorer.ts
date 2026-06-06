import { emptyLanguageScores, type LanguageScore } from "@/lib/i18n/detect-language";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n/types";

export type LanguageSignalCategory =
  | "phrase"
  | "stopword"
  | "vocabulary"
  | "accent"
  | "history";

export type LanguageEvidenceHit = {
  signal: string;
  category: LanguageSignalCategory;
  weight: number;
};

export type LanguageResolutionEvidence = Record<
  SupportedLanguage,
  LanguageEvidenceHit[]
>;

type SignalDefinition = {
  id: string;
  pattern: RegExp;
  category: LanguageSignalCategory;
  weight: number;
  weak?: boolean;
};

const WEAK_VOCABULARY_IDS = new Set([
  "casa",
  "milano",
  "milan",
  "milán",
  "budget",
  "navigli",
  "apartment",
  "house",
  "800k",
  "flat",
  "home",
]);

function phrase(id: string, pattern: RegExp): SignalDefinition {
  return { id, pattern, category: "phrase", weight: 5 };
}

function stopword(id: string, pattern: RegExp): SignalDefinition {
  return { id, pattern, category: "stopword", weight: 3 };
}

function vocab(id: string, pattern: RegExp, weak = false): SignalDefinition {
  return { id, pattern, category: "vocabulary", weight: 2, weak };
}

function accent(id: string, pattern: RegExp): SignalDefinition {
  return { id, pattern, category: "accent", weight: 2 };
}

const LANGUAGE_SIGNALS: Record<SupportedLanguage, SignalDefinition[]> = {
  it: [
    phrase("sto_cercando_casa", /\bsto cercando una casa\b/i),
    phrase("sto_cercando_appartamento", /\bsto cercando un appartamento\b/i),
    phrase("sto_cercando", /\bsto cercando\b/i),
    phrase("ho_bisogno_aiuto", /\bho bisogno di aiuto\b/i),
    phrase("salve", /\bsalve\b/i),
    phrase("cerco_casa", /\bcerco casa\b/i),
    phrase("cerco_appartamento", /\bcerco appartamento\b/i),
    phrase("vorrei_comprare", /\bvorrei comprare\b/i),
    phrase("vorrei_affittare", /\bvorrei affittare\b/i),
    phrase("mi_serve", /\bmi serve\b/i),
    phrase("ciao", /\bciao\b/i),
    stopword("di", /\b(di|del|della|dei|delle|che|per|con|un|una|il|la|gli|le)\b/i),
    stopword("ho_mi", /\b(ho|mi|sto|sono|vorrei)\b/i),
    vocab("appartamento", /\b(appartamento|immobile|zona|affittare|acquistare)\b/i),
    vocab("casa", /\bcasa\b/i, true),
    vocab("milano", /\b(milano|milán)\b/i, true),
    accent("it_chars", /[àèéìòù]/i),
  ],
  pt: [
    phrase("estou_procura", /\bestou (?:à|a) procura\b/i),
    phrase("preciso_ajuda", /\bpreciso de ajuda\b/i),
    phrase("quero_comprar", /\bquero comprar\b/i),
    phrase("quero_arrendar", /\bquero arrendar\b/i),
    phrase("procuro_casa", /\bprocuro casa\b/i),
    phrase("procuro_apartamento", /\bprocuro apartamento\b/i),
    phrase("procuro_uma", /\bprocuro uma\b/i),
    phrase("ola", /\bol[aá]\b/i),
    stopword("pt_fn", /\b(de|um|uma|em|para|que|com|estou|preciso|quero|até|por)\b/i),
    stopword("pt_verb", /\b(procuro|procurar|comprar|arrendar|moradia)\b/i),
    vocab("orçamento", /\b(orçamento|orcamento|imóvel|imoveis|imóveis)\b/i),
    vocab("casa", /\bcasa\b/i, true),
    vocab("milano", /\b(milano|milán)\b/i, true),
    accent("pt_chars", /[ãõç]/i),
  ],
  fr: [
    phrase("je_cherche", /\bje cherche\b/i),
    phrase("besoin_aide", /\bj['']ai besoin d['']aide\b/i),
    phrase("voudrais_acheter", /\bje voudrais acheter\b/i),
    phrase("voudrais_louer", /\bje voudrais louer\b/i),
    phrase("voudrais_appart", /\bje voudrais un appart\b/i),
    phrase("bonjour", /\bbonjour\b/i),
    stopword("fr_fn", /\b(je|j['']ai|une|un|des|le|la|les|à|au|aux|pour|avec|si|de|du)\b/i),
    stopword("fr_verb", /\b(cherche|voudrais|acheter|louer|besoin)\b/i),
    vocab("appartement", /\b(appart(?:ement)?|maison|immobilier|louer|acheter)\b/i),
    vocab("paris", /\bparis\b/i, true),
    accent("fr_chars", /[àâçéèêëîïôùûü]/i),
  ],
  en: [
    phrase("looking_for", /\b(?:i am|i['']m) looking for\b/i),
    phrase("looking_short", /\blooking for\b/i),
    phrase("need_help", /\bneed help\b/i),
    phrase("want_buy", /\bi want to buy\b/i),
    phrase("want_rent", /\bi want to rent\b/i),
    phrase("hello", /\b(?:hello|hi)\b/i),
    phrase("finding", /\bfinding an apartment\b/i),
    stopword("en_fn", /\b(the|a|an|for|with|in|near|to|of|and|or|if|please)\b/i),
    stopword("en_verb", /\b(need|want|looking|finding|help|buy|rent|thanks)\b/i),
    vocab("property", /\b(apartment|house|property|bedroom|bedrooms|buying|renting)\b/i),
    vocab("milan", /\bmilan\b/i, true),
    vocab("budget", /\bbudget\b/i, true),
  ],
  es: [
    phrase("estoy_buscando", /\bestoy buscando\b/i),
    phrase("necesito_ayuda", /\bnecesito ayuda\b/i),
    phrase("quiero_comprar", /\bquiero comprar\b/i),
    phrase("quiero_alquilar", /\bquiero alquilar\b/i),
    phrase("busco_casa", /\bbusco (?:una )?casa\b/i),
    phrase("busco_apartamento", /\bbusco (?:un )?apartamento\b/i),
    phrase("hola", /\bhola\b/i),
    stopword("es_fn", /\b(de|un|una|en|para|que|con|por|hasta|si|el|la|los|las)\b/i),
    stopword("es_verb", /\b(busco|buscar|quiero|necesito|comprar|alquilar)\b/i),
    vocab("vivienda", /\b(apartamento|vivienda|inmueble|alquilar|comprar)\b/i),
    vocab("casa", /\bcasa\b/i, true),
    accent("es_chars", /[ñ¿¡]/i),
  ],
};

export function emptyLanguageEvidence(): LanguageResolutionEvidence {
  return {
    pt: [],
    en: [],
    it: [],
    es: [],
    fr: [],
  };
}

function isWeakHit(hit: LanguageEvidenceHit): boolean {
  return hit.category === "vocabulary" && WEAK_VOCABULARY_IDS.has(hit.signal);
}

export function scoreTextLanguage(
  text: string,
  options?: { category?: LanguageSignalCategory; weightMultiplier?: number }
): {
  scores: LanguageScore;
  strongScores: LanguageScore;
  evidence: LanguageResolutionEvidence;
} {
  const normalized = text.trim();
  const scores = emptyLanguageScores();
  const strongScores = emptyLanguageScores();
  const evidence = emptyLanguageEvidence();
  const multiplier = options?.weightMultiplier ?? 1;
  const categoryFilter = options?.category;

  if (!normalized) {
    return { scores, strongScores, evidence };
  }

  for (const language of SUPPORTED_LANGUAGES) {
    for (const signal of LANGUAGE_SIGNALS[language]) {
      if (categoryFilter && signal.category !== categoryFilter) {
        continue;
      }
      if (!signal.pattern.test(normalized)) {
        continue;
      }

      const weight = Math.round(signal.weight * multiplier);
      const hit: LanguageEvidenceHit = {
        signal: signal.id,
        category: signal.category,
        weight,
      };

      scores[language] += weight;
      evidence[language].push(hit);

      if (!signal.weak && !isWeakHit(hit)) {
        strongScores[language] += weight;
      }
    }
  }

  return { scores, strongScores, evidence };
}

export function mergeLanguageEvidence(
  base: LanguageResolutionEvidence,
  extra: LanguageResolutionEvidence
): LanguageResolutionEvidence {
  const merged = emptyLanguageEvidence();
  for (const language of SUPPORTED_LANGUAGES) {
    merged[language] = [...base[language], ...extra[language]];
  }
  return merged;
}

export function mergeLanguageScores(
  base: LanguageScore,
  extra: LanguageScore
): LanguageScore {
  const merged = emptyLanguageScores();
  for (const language of SUPPORTED_LANGUAGES) {
    merged[language] = base[language] + extra[language];
  }
  return merged;
}

export function countPhraseHits(
  evidence: LanguageResolutionEvidence,
  language: SupportedLanguage
): number {
  return evidence[language].filter((hit) => hit.category === "phrase").length;
}

export function hasNonWeakStrongEvidence(
  evidence: LanguageResolutionEvidence,
  language: SupportedLanguage
): boolean {
  return evidence[language].some(
    (hit) =>
      hit.category === "phrase" ||
      hit.category === "stopword" ||
      hit.category === "accent" ||
      (hit.category === "vocabulary" && !isWeakHit(hit))
  );
}

export function rankLanguagesByScore(
  scores: LanguageScore
): { language: SupportedLanguage; score: number }[] {
  return SUPPORTED_LANGUAGES.map((language) => ({
    language,
    score: scores[language],
  })).sort((a, b) => b.score - a.score || a.language.localeCompare(b.language));
}

export function rankLanguagesByStrongScore(
  strongScores: LanguageScore
): { language: SupportedLanguage; score: number }[] {
  return rankLanguagesByScore(strongScores);
}
