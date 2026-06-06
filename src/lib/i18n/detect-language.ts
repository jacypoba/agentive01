import type { Conversation } from "@/types/database";
import { resolveConversationLanguage } from "@/lib/i18n/resolve-language";
import {
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from "@/lib/i18n/types";

export type LanguageScore = Record<SupportedLanguage, number>;

const STRONG_LANGUAGE_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  pt: [
    /\b(obrigad[oa]|obg|olá|ola|procuro|procurar|quais|está bem|tudo bem|imóvel|imoveis|imóveis|orçamento|orcamento|amanhã|manhã|mostra opções|mostra novamente|perfeito|perfeita|ficou|marcado|marcada|segunda-feira|segunda feira|podem|ajudar|euros?)\b/i,
    /[ãõç]/i,
  ],
  en: [
    /\b(thank|thanks|hello|hi\b|hey\b|looking for|please|viewing|schedule|bedroom|property|tomorrow|which|show me|show options|what you have|any options)\b/i,
    /\b(i['']m looking|i am looking|would like|interested in|buying|renting|bedrooms|under|up to|maximum)\b/i,
  ],
  it: [
    /\b(grazie|ciao|buongiorno|buonasera|cerco|cercare|voglio|domani|quale|mattina|pomeriggio|mostrami|fammi vedere|fami vedere|perfetto)\b/i,
    /\bfino\s+a\b/i,
  ],
  es: [
    /\b(gracias|hola|buenos días|buenas tardes|busco|buscar|quiero|mañana|manana|cuál|cual|presupuesto|hasta|habitacion|habitación|qué opciones|que opciones|muéstrame|muestrame|perfecto|agendada|quedó|quedo)\b/i,
    /[ñ¿¡]/i,
  ],
  fr: [
    /\b(merci|bonjour|bonsoir|je cherche|appartement|maison|acheter|immobilier|propri[eé]t[eé]|demain|parfait)\b/i,
    /[àâçéèêëîïôùûü]/i,
  ],
};

const WEAK_LANGUAGE_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  pt: [
    /\b(bom dia|boa tarde|boa noite|apartamento|moradia|visita|quero|até|quartos?|horário|tarde)\b/i,
  ],
  en: [/\b(apartment|house|visit|want|budget|morning|afternoon|options|listings)\b/i],
  it: [/\b(appartamento|casa|visita|camera|milano|budget)\b/i],
  es: [/\b(apartamento|casa|visita|horario|tarde)\b/i],
  fr: [/\b(appartement|maison|visite|budget|paris)\b/i],
};

export function emptyLanguageScores(): LanguageScore {
  return { pt: 0, en: 0, it: 0, es: 0, fr: 0 };
}

type ScoredText = {
  scores: LanguageScore;
  strongSignalCount: LanguageScore;
};

function scoreText(text: string): ScoredText {
  const scores = emptyLanguageScores();
  const strongSignalCount = emptyLanguageScores();
  const normalized = text.trim();
  if (!normalized) {
    return { scores, strongSignalCount };
  }

  for (const language of Object.keys(STRONG_LANGUAGE_PATTERNS) as SupportedLanguage[]) {
    for (const pattern of STRONG_LANGUAGE_PATTERNS[language]) {
      if (pattern.test(normalized)) {
        scores[language] += 3;
        strongSignalCount[language] += 1;
      }
    }
  }

  for (const language of Object.keys(WEAK_LANGUAGE_PATTERNS) as SupportedLanguage[]) {
    for (const pattern of WEAK_LANGUAGE_PATTERNS[language]) {
      if (pattern.test(normalized)) {
        scores[language] += 1;
      }
    }
  }

  return { scores, strongSignalCount };
}

function pickHighestScore(scores: LanguageScore): SupportedLanguage {
  let best: SupportedLanguage = DEFAULT_LANGUAGE;
  let bestScore = -1;

  for (const language of ["fr", "es", "it", "en", "pt"] as SupportedLanguage[]) {
    if (scores[language] > bestScore) {
      best = language;
      bestScore = scores[language];
    }
  }

  return bestScore > 0 ? best : DEFAULT_LANGUAGE;
}

export type LanguageDetectionResult = {
  language: SupportedLanguage;
  confident: boolean;
  scores: LanguageScore;
  strongSignalCount: LanguageScore;
};

export function detectLanguageWithConfidence(
  text: string,
  fallback: SupportedLanguage = DEFAULT_LANGUAGE
): LanguageDetectionResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      language: fallback,
      confident: false,
      scores: emptyLanguageScores(),
      strongSignalCount: emptyLanguageScores(),
    };
  }

  const { scores, strongSignalCount } = scoreText(trimmed);
  const ranked = (["pt", "en", "it", "es", "fr"] as SupportedLanguage[])
    .map((language) => ({ language, score: scores[language] }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0]!;
  const second = ranked[1]!;

  if (top.score === 0) {
    return { language: fallback, confident: false, scores, strongSignalCount };
  }

  const confident =
    top.score >= 3 ||
    (top.score >= 2 && top.score - second.score >= 2) ||
    (trimmed.length >= 20 && top.score >= 2 && top.score > second.score);

  return {
    language: top.language,
    confident,
    scores,
    strongSignalCount,
  };
}

/** Detect language from a single message using deterministic heuristics. */
export function detectLanguageFromText(
  text: string,
  fallback: SupportedLanguage = DEFAULT_LANGUAGE
): SupportedLanguage {
  return detectLanguageWithConfidence(text, fallback).language;
}

/** Prefer the latest client message only — do not blend older history. */
export function detectLanguageFromHistory(
  history: Conversation[],
  latestMessage?: string,
  fallback: SupportedLanguage = DEFAULT_LANGUAGE
): SupportedLanguage {
  if (latestMessage?.trim()) {
    return detectLanguageFromText(latestMessage, fallback);
  }

  const lastClient = history
    .filter((item) => item.sender === "client")
    .slice(-1)[0]?.message;

  if (!lastClient?.trim()) {
    return fallback;
  }

  return detectLanguageFromText(lastClient, fallback);
}

export function resolveLeadLanguage(
  leadPreferred: string | null | undefined,
  latestMessage: string,
  _history: Conversation[]
): SupportedLanguage {
  return resolveConversationLanguage({
    latestMessage,
    leadPreferred,
  });
}
