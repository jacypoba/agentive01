import type { FollowUpContextSnapshot, FollowUpType } from "@/types/database";
import { generateLocalizedFollowUpMessage } from "@/lib/i18n/messages";
import { normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";

export function generateFollowUpMessage(
  type: FollowUpType,
  context: FollowUpContextSnapshot,
  seed: string,
  language: SupportedLanguage = "pt"
): string {
  const lang = normalizeLanguage(context.preferred_language ?? language);
  return generateLocalizedFollowUpMessage(lang, type, context, seed);
}
