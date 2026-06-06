import type { Conversation } from "@/types/database";
import {
  countPhraseHits,
  hasNonWeakStrongEvidence,
  mergeLanguageEvidence,
  mergeLanguageScores,
  rankLanguagesByScore,
  rankLanguagesByStrongScore,
  scoreTextLanguage,
  type LanguageResolutionEvidence,
} from "@/lib/i18n/language-scorer";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/lib/i18n/types";

export type LanguageResolutionConfidence = "high" | "medium" | "low";

export type LanguageResolutionReason =
  | "explicit_request"
  | "clear_current_message"
  | "strong_current_message"
  | "sticky_ambiguous"
  | "default_new_lead"
  | "uncertain_keep_stored";

export type LanguageResolutionResult = {
  finalLanguage: SupportedLanguage;
  reason: LanguageResolutionReason;
  confidence: LanguageResolutionConfidence;
  evidence: LanguageResolutionEvidence;
  scores: Record<SupportedLanguage, number>;
  strongScores: Record<SupportedLanguage, number>;
  detectedLanguage: SupportedLanguage;
  storedLanguage: string | null;
};

export type ResolveConversationLanguageInput = {
  latestMessage: string;
  storedLanguage?: string | null;
  conversationHistory?: Conversation[];
  explicitLanguageRequest?: SupportedLanguage | null;
};

const MIN_CLEAR_STRONG_SCORE = 5;
const MIN_SWITCH_STRONG_SCORE = 3;
const MIN_SCORE_MARGIN = 3;
const HISTORY_WEIGHT = 0.35;

const AMBIGUOUS_ONLY =
  /^(ok|okay|k|sim|s[ií]|no|n[aã]o|yes|yep|yeah|merci|gracias|grazie|obrigad[oa]?|thanks|thank you|thx|👍|👌|🙂|😊|\.+|!+|\?+)+$/iu;

const GREETING_ONLY =
  /^(ol[aá]|hi|hello|hey|ciao|hola|buongiorno|buonasera|bom dia|boa tarde|boa noite|salve|bonjour)[\s!.?👋🙂😊]*$/iu;

const WEAK_ONLY_MESSAGE =
  /^(?:\s|casa|milano|milan|mil[aá]n|budget|\d[\dk]*)+$/iu;

function getStoredLanguage(
  storedLanguage?: string | null
): SupportedLanguage | null {
  if (storedLanguage == null || !isSupportedLanguage(storedLanguage)) {
    return null;
  }
  return storedLanguage;
}

function clientHistoryText(history: Conversation[]): string[] {
  return history
    .filter((item) => item.sender === "client")
    .map((item) => item.message.trim())
    .filter(Boolean)
    .slice(-3);
}

function scoreWithHistory(
  latestMessage: string,
  history: Conversation[]
): {
  scores: Record<SupportedLanguage, number>;
  strongScores: Record<SupportedLanguage, number>;
  evidence: LanguageResolutionEvidence;
} {
  const latest = scoreTextLanguage(latestMessage);
  let scores = latest.scores;
  let strongScores = latest.strongScores;
  let evidence = latest.evidence;

  const priorMessages = clientHistoryText(history).filter(
    (message) => message !== latestMessage.trim()
  );

  for (const message of priorMessages) {
    const historical = scoreTextLanguage(message, {
      weightMultiplier: HISTORY_WEIGHT,
    });

    scores = mergeLanguageScores(scores, historical.scores);
    strongScores = mergeLanguageScores(strongScores, historical.strongScores);
    evidence = mergeLanguageEvidence(evidence, historical.evidence);
  }

  return { scores, strongScores, evidence };
}

function isAmbiguousLatestMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 2) return true;
  if (AMBIGUOUS_ONLY.test(trimmed)) return true;
  if (GREETING_ONLY.test(trimmed)) return true;
  if (WEAK_ONLY_MESSAGE.test(trimmed)) return true;

  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length === 0;
}

function buildResult(
  input: ResolveConversationLanguageInput,
  finalLanguage: SupportedLanguage,
  reason: LanguageResolutionReason,
  confidence: LanguageResolutionConfidence,
  evidence: LanguageResolutionEvidence,
  scores: Record<SupportedLanguage, number>,
  strongScores: Record<SupportedLanguage, number>,
  detectedLanguage: SupportedLanguage
): LanguageResolutionResult {
  return {
    finalLanguage,
    reason,
    confidence,
    evidence,
    scores,
    strongScores,
    detectedLanguage,
    storedLanguage: input.storedLanguage ?? null,
  };
}

function deriveConfidence(
  topStrong: number,
  margin: number,
  phraseHits: number
): LanguageResolutionConfidence {
  if (phraseHits >= 2 || (topStrong >= MIN_CLEAR_STRONG_SCORE && margin >= MIN_SCORE_MARGIN)) {
    return "high";
  }
  if (topStrong >= MIN_SWITCH_STRONG_SCORE && margin >= 2) {
    return "medium";
  }
  return "low";
}

export function resolveConversationLanguageStrategy(
  input: ResolveConversationLanguageInput
): LanguageResolutionResult {
  const stored = getStoredLanguage(input.storedLanguage);
  const trimmed = input.latestMessage.trim();
  const fallback = stored ?? DEFAULT_LANGUAGE;
  const history = input.conversationHistory ?? [];

  if (input.explicitLanguageRequest) {
    const scored = scoreTextLanguage(trimmed);
    return buildResult(
      input,
      input.explicitLanguageRequest,
      "explicit_request",
      "high",
      scored.evidence,
      scored.scores,
      scored.strongScores,
      input.explicitLanguageRequest
    );
  }

  if (isAmbiguousLatestMessage(trimmed)) {
    const scored = trimmed ? scoreTextLanguage(trimmed) : scoreTextLanguage("");
    const detected = rankLanguagesByScore(scored.scores)[0]?.language ?? fallback;
    return buildResult(
      input,
      stored ?? DEFAULT_LANGUAGE,
      "sticky_ambiguous",
      "low",
      scored.evidence,
      scored.scores,
      scored.strongScores,
      detected
    );
  }

  const { scores, strongScores, evidence } = scoreWithHistory(trimmed, history);
  const ranked = rankLanguagesByScore(scores);
  const strongRanked = rankLanguagesByStrongScore(strongScores);
  const top = ranked[0]!;
  const second = ranked[1] ?? { language: fallback, score: 0 };
  const topStrong = strongRanked[0]!;
  const secondStrong = strongRanked[1] ?? { language: fallback, score: 0 };
  const margin = top.score - second.score;
  const strongMargin = topStrong.score - secondStrong.score;
  const phraseHits = countPhraseHits(evidence, top.language);
  const topHasStrongEvidence = hasNonWeakStrongEvidence(evidence, top.language);
  const confidence = deriveConfidence(topStrong.score, strongMargin, phraseHits);

  const canSwitchFromStored =
    topHasStrongEvidence &&
    top.language !== stored &&
    phraseHits >= 1 &&
    topStrong.score >= MIN_SWITCH_STRONG_SCORE &&
    (strongMargin >= 2 || phraseHits >= 2);

  if (stored) {
    if (canSwitchFromStored) {
      const reason =
        phraseHits >= 1 && topStrong.score >= MIN_CLEAR_STRONG_SCORE
          ? "strong_current_message"
          : "clear_current_message";
      return buildResult(
        input,
        top.language,
        reason,
        confidence,
        evidence,
        scores,
        strongScores,
        top.language
      );
    }

    if (top.language === stored && topHasStrongEvidence && topStrong.score >= MIN_SWITCH_STRONG_SCORE) {
      return buildResult(
        input,
        stored,
        "clear_current_message",
        confidence,
        evidence,
        scores,
        strongScores,
        top.language
      );
    }

    if (!topHasStrongEvidence || topStrong.score < MIN_SWITCH_STRONG_SCORE) {
      return buildResult(
        input,
        stored,
        "uncertain_keep_stored",
        "low",
        evidence,
        scores,
        strongScores,
        top.language
      );
    }

    return buildResult(
      input,
      stored,
      "uncertain_keep_stored",
      "low",
      evidence,
      scores,
      strongScores,
      top.language
    );
  }

  if (topHasStrongEvidence && topStrong.score >= MIN_SWITCH_STRONG_SCORE) {
    const reason =
      phraseHits >= 1 ? "strong_current_message" : "clear_current_message";
    return buildResult(
      input,
      top.language,
      reason,
      confidence,
      evidence,
      scores,
      strongScores,
      top.language
    );
  }

  return buildResult(
    input,
    DEFAULT_LANGUAGE,
    "default_new_lead",
    "low",
    evidence,
    scores,
    strongScores,
    top.language
  );
}

export function logLanguageResolverEvidence(
  input: ResolveConversationLanguageInput,
  result: LanguageResolutionResult
): void {
  console.log("[Language resolver evidence]", {
    latestMessage: input.latestMessage.trim().slice(0, 160),
    storedLanguage: result.storedLanguage,
    finalLanguage: result.finalLanguage,
    reason: result.reason,
    confidence: result.confidence,
    evidence: summarizeEvidence(result.evidence),
    scores: result.scores,
    strongScores: result.strongScores,
  });
}

function summarizeEvidence(
  evidence: LanguageResolutionEvidence
): Record<SupportedLanguage, string[]> {
  const summary = {} as Record<SupportedLanguage, string[]>;
  for (const language of Object.keys(evidence) as SupportedLanguage[]) {
    summary[language] = evidence[language].map(
      (hit) => `${hit.category}:${hit.signal}`
    );
  }
  return summary;
}

export function isAmbiguousMessage(text: string): boolean {
  return isAmbiguousLatestMessage(text);
}

export function isGreetingOnlyMessage(text: string): boolean {
  return GREETING_ONLY.test(text.trim());
}
