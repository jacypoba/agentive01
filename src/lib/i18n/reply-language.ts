import { detectLanguageWithConfidence } from "@/lib/i18n/detect-language";
import {
  getLanguageLabel,
  type SupportedLanguage,
} from "@/lib/i18n/types";
import { AI_LANGUAGE_INSTRUCTION } from "@/lib/i18n/messages";
import { hasLanguageMixing } from "@/lib/i18n/language-purity";

/** Openers that read as generic support-bot, not a WhatsApp consultant. */
export const BANNED_REPLY_OPENERS: RegExp[] = [
  /^got it\b/i,
  /^okay\b/i,
  /^ok[\s,.!—-]/i,
  /^sure\b/i,
  /^yep\b/i,
  /^yeah\b/i,
  /^bo[aá][\s,.!—-]/i,
  /^understood\b/i,
  /^noted\b/i,
  /^thanks for\b/i,
  /^thank you for\b/i,
];

/** Full-message generic replies (too short / low effort). */
export const GENERIC_WHOLE_REPLY_PATTERN =
  /^(got it|okay|ok|sure|yep|yeah|bo[aá]|boa|entendido|capito|perfecto|perfeito|thanks|thank you|obrigad[oa])[\s,.!—\-👌🙂😊]*$/i;

const ENGLISH_LEAK_WHEN_NOT_EN: Partial<Record<SupportedLanguage, RegExp[]>> = {
  pt: [
    /\b(got it|looking for|budget|show me|let me know|happy to help|i'll check|i will check|on it)\b/i,
  ],
  it: [
    /\b(got it|looking for|budget|show me|let me know|happy to help|i'll check)\b/i,
  ],
  es: [
    /\b(got it|looking for|budget|show me|let me know|happy to help|i'll check)\b/i,
  ],
};

export type ReplyLanguageValidation = {
  valid: boolean;
  reason?:
    | "empty"
    | "generic"
    | "banned_opener"
    | "wrong_language"
    | "language_mixing"
    | "english_leak";
};

export function isGenericLowEffortReply(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  if (GENERIC_WHOLE_REPLY_PATTERN.test(trimmed)) {
    return true;
  }

  if (trimmed.length <= 18) {
    return BANNED_REPLY_OPENERS.some((pattern) => pattern.test(trimmed));
  }

  return BANNED_REPLY_OPENERS.some((pattern) => pattern.test(trimmed));
}

export function validateReplyLanguage(
  reply: string,
  expected: SupportedLanguage
): ReplyLanguageValidation {
  const trimmed = reply.trim();
  if (!trimmed) {
    return { valid: false, reason: "empty" };
  }

  if (isGenericLowEffortReply(trimmed)) {
    return {
      valid: false,
      reason: GENERIC_WHOLE_REPLY_PATTERN.test(trimmed) ? "generic" : "banned_opener",
    };
  }

  if (hasLanguageMixing(trimmed, expected)) {
    return { valid: false, reason: "language_mixing" };
  }

  const leaks = ENGLISH_LEAK_WHEN_NOT_EN[expected];
  if (expected !== "en" && leaks?.some((pattern) => pattern.test(trimmed))) {
    return { valid: false, reason: "english_leak" };
  }

  const detection = detectLanguageWithConfidence(trimmed, expected);
  if (detection.confident && detection.language !== expected) {
    return { valid: false, reason: "wrong_language" };
  }

  return { valid: true };
}

export function buildStrictReplyLanguageDirective(
  language: SupportedLanguage,
  latestClientMessage?: string
): string {
  const label = getLanguageLabel(language);
  const snippet = latestClientMessage?.trim()
    ? `Client's latest message (detected ${label}): "${latestClientMessage.trim().slice(0, 160)}"`
    : `Detected client language: ${label}`;

  return [
    "=== REPLY LANGUAGE (HIGHEST PRIORITY — overrides workspace default & preferred languages) ===",
    snippet,
    AI_LANGUAGE_INSTRUCTION[language],
    `Write the ENTIRE reply in ${label} — every word, including FAQ answers adapted from workspace knowledge.`,
    "NEVER reply in English when the client wrote in Portuguese, Italian, or Spanish (and vice versa).",
    "Forbidden openers: Got it, Okay, Ok, Boa, Sure, Noted, Understood as standalone confirmations.",
    "Sound like a real premium real-estate consultant on WhatsApp — specific, human, never call-centre generic.",
  ].join("\n");
}

export const REPLY_LANGUAGE_CORRECTION: Record<SupportedLanguage, string> = {
  pt: "Reescreve a resposta anterior só em português de Portugal. Proibido inglês, 'Got it', 'Okay' ou 'Boa' genéricos. Tom de consultor imobiliário premium no WhatsApp — concreto e natural.",
  en: "Rewrite your previous reply in English only. No generic 'Got it' or 'Okay' openers. Premium WhatsApp real-estate consultant tone — specific and human.",
  it: "Riscrivi la risposta precedente solo in italiano. Niente 'Got it' o 'Okay' generici. Tono consulente immobiliare premium su WhatsApp — concreto e naturale.",
  es: "Reescribe la respuesta anterior solo en español. Prohibido 'Got it' u 'Okay' genéricos. Tono consultor inmobiliario premium en WhatsApp — concreto y natural.",
};

export const CONSULTANT_LANGUAGE_FALLBACK: Record<SupportedLanguage, string> = {
  pt: "Claro — já vejo opções dentro desse perfil. Prefere alguma zona em específico?",
  en: "Sure — I'll look at options in that range. Any preferred area?",
  it: "Certo — guardo cosa c'è in quella fascia. Zona preferita?",
  es: "Claro — miro opciones en ese rango. ¿Alguna zona preferida?",
};

export function getConsultantLanguageFallback(
  language: SupportedLanguage
): string {
  return CONSULTANT_LANGUAGE_FALLBACK[language];
}
