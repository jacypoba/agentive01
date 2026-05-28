import type { Conversation } from "@/types/database";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/lib/i18n/types";

type LanguageScore = Record<SupportedLanguage, number>;

const STRONG_LANGUAGE_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  pt: [
    /\b(obrigad[oa]|obg|olá|ola|procuro|procurar|quais|está bem|tudo bem|imóvel|imoveis|orçamento|orcamento|amanhã|manhã|mostra opções|mostra novamente)\b/i,
    /[ãõç]/i,
  ],
  en: [
    /\b(thank|thanks|hello|hi\b|hey\b|looking for|please|viewing|schedule|bedroom|property|tomorrow|which|show me|show options|what you have|any options)\b/i,
  ],
  it: [
    /\b(grazie|ciao|buongiorno|buonasera|cerco|cercare|voglio|domani|quale|mattina|pomeriggio|fino a|mostrami|fammi vedere|fami vedere)\b/i,
  ],
  es: [
    /\b(gracias|hola|buenos días|buenas tardes|busco|buscar|quiero|mañana|manana|cuál|cual|presupuesto|hasta|habitacion|habitación|qué opciones|que opciones|muéstrame|muestrame)\b/i,
    /[ñ¿¡]/i,
  ],
};

const WEAK_LANGUAGE_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  pt: [
    /\b(bom dia|boa tarde|boa noite|apartamento|moradia|visita|quero|até|quartos?|horário|tarde)\b/i,
  ],
  en: [/\b(apartment|house|visit|want|budget|morning|afternoon|options|listings)\b/i],
  it: [/\b(appartamento|casa|visita|camera|milano|budget)\b/i],
  es: [/\b(apartamento|casa|visita|horario|tarde)\b/i],
};

function emptyScores(): LanguageScore {
  return { pt: 0, en: 0, it: 0, es: 0 };
}

function scoreText(text: string): LanguageScore {
  const scores = emptyScores();
  const normalized = text.trim();
  if (!normalized) {
    return scores;
  }

  for (const language of Object.keys(STRONG_LANGUAGE_PATTERNS) as SupportedLanguage[]) {
    for (const pattern of STRONG_LANGUAGE_PATTERNS[language]) {
      if (pattern.test(normalized)) {
        scores[language] += 3;
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

  return scores;
}

function pickHighestScore(scores: LanguageScore): SupportedLanguage {
  let best: SupportedLanguage = DEFAULT_LANGUAGE;
  let bestScore = -1;

  for (const language of ["es", "it", "en", "pt"] as SupportedLanguage[]) {
    if (scores[language] > bestScore) {
      best = language;
      bestScore = scores[language];
    }
  }

  return bestScore > 0 ? best : DEFAULT_LANGUAGE;
}

/** Detect language from a single message using deterministic heuristics. */
export function detectLanguageFromText(
  text: string,
  fallback: SupportedLanguage = DEFAULT_LANGUAGE
): SupportedLanguage {
  const trimmed = text.trim();
  if (!trimmed) {
    return fallback;
  }

  const scores = scoreText(trimmed);
  const detected = pickHighestScore(scores);
  return detected === DEFAULT_LANGUAGE && bestScoreFrom(scores) === 0
    ? fallback
    : detected;
}

function bestScoreFrom(scores: LanguageScore): number {
  return Math.max(scores.pt, scores.en, scores.it, scores.es);
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
  history: Conversation[]
): SupportedLanguage {
  const stored = isSupportedLanguage(leadPreferred)
    ? leadPreferred
    : DEFAULT_LANGUAGE;

  const detected = detectLanguageFromHistory(history, latestMessage, stored);

  if (detected !== stored && latestMessage.trim().length >= 3) {
    const latestOnly = detectLanguageFromText(latestMessage, stored);
    if (latestOnly !== stored) {
      return latestOnly;
    }
  }

  return detected;
}
