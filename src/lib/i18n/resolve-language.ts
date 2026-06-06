import { isStabilityPatchV1Enabled } from "@/lib/ai/stability-patch";
import {
  detectLanguageWithConfidence,
  emptyLanguageScores,
  type LanguageDetectionResult,
} from "@/lib/i18n/detect-language";
import { detectFirstMessageLanguage } from "@/lib/i18n/first-message-language";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/lib/i18n/types";

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

const AMBIGUOUS_ONLY = /^(ok|okay|k|sim|s[ií]|no|n[aã]o|yes|yep|yeah|👍|👌|🙂|😊|\.+|!+|\?+)+$/iu;

const GREETING_ONLY =
  /^(ol[aá]|hi|hello|hey|ciao|hola|buongiorno|buonasera|bom dia|boa tarde|boa noite)[\s!.?👋🙂😊]*$/iu;

export type LanguageResolutionReason =
  | "explicit"
  | "ambiguous"
  | "sticky"
  | "confident_switch"
  | "strong_signals"
  | "first_message_language"
  | "default_new_lead";

export type LanguageResolutionDebug = {
  detectedLanguage: SupportedLanguage;
  strongSignalCount: Record<SupportedLanguage, number>;
  confident: boolean;
  storedLanguage: string | null;
  finalLanguage: SupportedLanguage;
  reason: LanguageResolutionReason;
};

function getStoredLanguage(
  leadPreferred?: string | null
): SupportedLanguage | null {
  if (leadPreferred == null || !isSupportedLanguage(leadPreferred)) {
    return null;
  }
  return leadPreferred;
}

function isGreetingOnlyMessage(text: string): boolean {
  return GREETING_ONLY.test(text.trim());
}

function buildDebugFromDetection(
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
  };
}

function resolveStickyConversationLanguage(input: {
  latestMessage: string;
  leadPreferred?: string | null;
}): LanguageResolutionDebug {
  const storedRaw = input.leadPreferred ?? null;
  const stored = getStoredLanguage(input.leadPreferred);
  const trimmed = input.latestMessage.trim();
  const fallback = stored ?? DEFAULT_LANGUAGE;

  const explicit = detectExplicitLanguageSwitch(trimmed);
  if (explicit) {
    const detection = detectLanguageWithConfidence(trimmed, fallback);
    return buildDebugFromDetection(detection, storedRaw, explicit, "explicit");
  }

  if (
    !trimmed ||
    isAmbiguousMessage(trimmed) ||
    isGreetingOnlyMessage(trimmed)
  ) {
    const detection = trimmed
      ? detectLanguageWithConfidence(trimmed, fallback)
      : {
          language: fallback,
          confident: false,
          scores: emptyLanguageScores(),
          strongSignalCount: emptyLanguageScores(),
        };
    return buildDebugFromDetection(
      detection,
      storedRaw,
      stored ?? DEFAULT_LANGUAGE,
      "ambiguous"
    );
  }

  if (!stored) {
    const firstMessageLanguage = detectFirstMessageLanguage(trimmed);
    if (firstMessageLanguage) {
      const detection = detectLanguageWithConfidence(trimmed, firstMessageLanguage);
      return buildDebugFromDetection(
        detection,
        storedRaw,
        firstMessageLanguage,
        "first_message_language"
      );
    }
  }

  const detection = detectLanguageWithConfidence(trimmed, fallback);
  const top = detection.language;
  const topStrong = detection.strongSignalCount[top] ?? 0;
  const canSwitch = detection.confident || topStrong >= 2;

  if (stored) {
    const storedScore = detection.scores[stored] ?? 0;
    const topScore = detection.scores[top] ?? 0;

    if (top !== stored && canSwitch && topScore > storedScore) {
      const reason: LanguageResolutionReason = detection.confident
        ? "confident_switch"
        : "strong_signals";
      return buildDebugFromDetection(detection, storedRaw, top, reason);
    }

    return buildDebugFromDetection(detection, storedRaw, stored, "sticky");
  }

  if (canSwitch) {
    const reason: LanguageResolutionReason = detection.confident
      ? "confident_switch"
      : "strong_signals";
    return buildDebugFromDetection(detection, storedRaw, top, reason);
  }

  return buildDebugFromDetection(
    detection,
    storedRaw,
    DEFAULT_LANGUAGE,
    "default_new_lead"
  );
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
    return buildDebugFromDetection(detection, storedRaw, explicit, "explicit");
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
    return buildDebugFromDetection(detection, storedRaw, stored, "ambiguous");
  }

  const detection = detectLanguageWithConfidence(trimmed, stored);
  if (detection.confident || (detection.scores[detection.language] ?? 0) >= 2) {
    const reason: LanguageResolutionReason = detection.confident
      ? "confident_switch"
      : "strong_signals";
    return buildDebugFromDetection(
      detection,
      storedRaw,
      detection.language,
      reason
    );
  }

  return buildDebugFromDetection(detection, storedRaw, stored, "sticky");
}

/**
 * Single source of truth for outbound WhatsApp language.
 * Uses ONLY the latest user message (+ explicit switch requests).
 * Falls back to lead preferred_language when the latest message is ambiguous.
 */
function logLanguageDecision(
  input: { latestMessage: string; leadId?: string },
  debug: LanguageResolutionDebug
): void {
  console.log("[Stability patch] Language decision", {
    leadId: input.leadId ?? null,
    latestMessagePreview: input.latestMessage.trim().slice(0, 80),
    detectedLanguage: debug.detectedLanguage,
    strongSignalCount: debug.strongSignalCount,
    confident: debug.confident,
    storedLanguage: debug.storedLanguage,
    finalLanguage: debug.finalLanguage,
    reason: debug.reason,
  });

  if (debug.reason === "first_message_language") {
    console.log("[Language V3] First message detection", {
      leadId: input.leadId ?? null,
      detectedLanguage: debug.finalLanguage,
      reason: "first_message_language",
    });
  }
}

export function resolveConversationLanguageDebug(input: {
  latestMessage: string;
  leadPreferred?: string | null;
  leadId?: string;
}): LanguageResolutionDebug {
  const debug = isStabilityPatchV1Enabled()
    ? resolveStickyConversationLanguage(input)
    : resolveLegacyConversationLanguage(input);

  if (isStabilityPatchV1Enabled()) {
    logLanguageDecision(input, debug);
  }

  return debug;
}

export function resolveConversationLanguage(input: {
  latestMessage: string;
  leadPreferred?: string | null;
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

  if (AMBIGUOUS_ONLY.test(trimmed)) {
    return true;
  }

  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length === 0;
}

export type { LanguageDetectionResult };
