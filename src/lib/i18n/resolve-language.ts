import { isStabilityPatchV1Enabled } from "@/lib/ai/stability-patch";
import {
  detectLanguageWithConfidence,
  emptyLanguageScores,
  type LanguageDetectionResult,
} from "@/lib/i18n/detect-language";
import {
  logLanguageResolverEvidence,
  resolveConversationLanguageStrategy,
  type LanguageResolutionConfidence,
  type LanguageResolutionReason as StrategyReason,
  type LanguageResolutionResult,
  type ResolveConversationLanguageInput,
} from "@/lib/i18n/language-resolver";
import type { LanguageResolutionEvidence } from "@/lib/i18n/language-scorer";
import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/lib/i18n/types";
import type { Conversation } from "@/types/database";

const EXPLICIT_LANGUAGE_SWITCH: { language: SupportedLanguage; pattern: RegExp }[] = [
  { language: "en", pattern: /\b(in english|speak english|english please|reply in english)\b/i },
  {
    language: "pt",
    pattern:
      /\b(em portugu[eê]s|in portuguese|portugu[eê]s por favor|fala portugu[eê]s|responde em portugu[eê]s)\b/i,
  },
  {
    language: "it",
    pattern: /\b(in italiano|speak italian|italiano per favore|rispondi in italiano)\b/i,
  },
  {
    language: "es",
    pattern:
      /\b(en espa[nñ]ol|in spanish|espa[nñ]ol por favor|habla espa[nñ]ol|responde en espa[nñ]ol)\b/i,
  },
  {
    language: "fr",
    pattern:
      /\b(en fran[cç]ais|in french|fran[cç]ais s['']il vous pla[iî]t|r[eé]pondez en fran[cç]ais)\b/i,
  },
];

/** Strategy reasons (STABILITY_PATCH_V1) plus legacy patch-off reasons. */
export type LanguageResolutionReason =
  | StrategyReason
  | "explicit"
  | "ambiguous"
  | "sticky"
  | "confident_switch"
  | "strong_signals"
  | "first_message_language";

export type LanguageResolutionDebug = {
  detectedLanguage: SupportedLanguage;
  strongSignalCount: Record<SupportedLanguage, number>;
  confident: boolean;
  storedLanguage: string | null;
  finalLanguage: SupportedLanguage;
  reason: LanguageResolutionReason;
  confidence: LanguageResolutionConfidence;
  evidence: LanguageResolutionEvidence;
  scores: Record<SupportedLanguage, number>;
  strongScores: Record<SupportedLanguage, number>;
};

function buildLegacyDebugFromDetection(
  detection: LanguageDetectionResult,
  storedRaw: string | null,
  finalLanguage: SupportedLanguage,
  reason: LanguageResolutionReason
): LanguageResolutionDebug {
  return {
    detectedLanguage: detection.language,
    strongSignalCount: detection.strongSignalCount,
    confident: detection.confident,
    storedLanguage: storedRaw,
    finalLanguage,
    reason,
    confidence: detection.confident ? "high" : "medium",
    evidence: {
      pt: [],
      en: [],
      it: [],
      es: [],
      fr: [],
    },
    scores: detection.scores,
    strongScores: detection.strongSignalCount,
  };
}

function buildDebugFromStrategy(result: LanguageResolutionResult): LanguageResolutionDebug {
  return {
    detectedLanguage: result.detectedLanguage,
    strongSignalCount: result.strongScores,
    confident: result.confidence !== "low",
    storedLanguage: result.storedLanguage,
    finalLanguage: result.finalLanguage,
    reason: result.reason,
    confidence: result.confidence,
    evidence: result.evidence,
    scores: result.scores,
    strongScores: result.strongScores,
  };
}

function resolveLegacyConversationLanguage(input: {
  latestMessage: string;
  leadPreferred?: string | null;
}): LanguageResolutionDebug {
  const storedRaw = input.leadPreferred ?? null;
  const stored = normalizeLanguage(input.leadPreferred);
  const trimmed = input.latestMessage.trim();

  const explicit = detectExplicitLanguageSwitch(trimmed);
  if (explicit) {
    const detection = detectLanguageWithConfidence(trimmed, stored);
    return buildLegacyDebugFromDetection(detection, storedRaw, explicit, "explicit");
  }

  if (!trimmed || isAmbiguousMessage(trimmed)) {
    const detection = trimmed
      ? detectLanguageWithConfidence(trimmed, stored)
      : {
          language: stored,
          confident: false,
          scores: emptyLanguageScores(),
          strongSignalCount: emptyLanguageScores(),
        };
    return buildLegacyDebugFromDetection(detection, storedRaw, stored, "ambiguous");
  }

  const detection = detectLanguageWithConfidence(trimmed, stored);
  if (detection.confident || (detection.scores[detection.language] ?? 0) >= 2) {
    const reason: LanguageResolutionReason = detection.confident
      ? "confident_switch"
      : "strong_signals";
    return buildLegacyDebugFromDetection(
      detection,
      storedRaw,
      detection.language,
      reason
    );
  }

  return buildLegacyDebugFromDetection(detection, storedRaw, stored, "sticky");
}

export function logLanguageFinalCheck(input: {
  incomingText: string;
  storedLanguage: string | null;
  detectedLanguage: SupportedLanguage;
  finalLanguage: SupportedLanguage;
  replyPreview: string | null;
}): void {
  console.log("[Language final check]", {
    incomingText: input.incomingText.trim().slice(0, 120),
    storedLanguage: input.storedLanguage,
    detectedLanguage: input.detectedLanguage,
    finalLanguage: input.finalLanguage,
    replyPreview: input.replyPreview?.slice(0, 120) ?? null,
  });
}

export function resolveConversationLanguageDebug(input: {
  latestMessage: string;
  leadPreferred?: string | null;
  leadId?: string;
  conversationHistory?: Conversation[];
  explicitLanguageRequest?: SupportedLanguage | null;
}): LanguageResolutionDebug {
  if (!isStabilityPatchV1Enabled()) {
    return resolveLegacyConversationLanguage(input);
  }

  const strategyInput: ResolveConversationLanguageInput = {
    latestMessage: input.latestMessage,
    storedLanguage: input.leadPreferred ?? null,
    conversationHistory: input.conversationHistory,
    explicitLanguageRequest:
      input.explicitLanguageRequest ??
      detectExplicitLanguageSwitch(input.latestMessage),
  };

  const result = resolveConversationLanguageStrategy(strategyInput);
  logLanguageResolverEvidence(strategyInput, result);

  return buildDebugFromStrategy(result);
}

export function resolveConversationLanguage(input: {
  latestMessage: string;
  leadPreferred?: string | null;
  conversationHistory?: Conversation[];
  explicitLanguageRequest?: SupportedLanguage | null;
}): SupportedLanguage {
  return resolveConversationLanguageDebug(input).finalLanguage;
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

  if (
    /^(ok|okay|k|sim|s[ií]|no|n[aã]o|yes|yep|yeah|merci|gracias|grazie|obrigad[oa]?|thanks|thank you|thx|👍|👌|🙂|😊|\.+|!+|\?+)+$/iu.test(
      trimmed
    )
  ) {
    return true;
  }

  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length === 0;
}

export type { LanguageDetectionResult, LanguageResolutionEvidence };
