import { isStabilityPatchV1Enabled } from "@/lib/ai/stability-patch";
import {
  resolveConversationLanguageDebug,
  type LanguageResolutionReason,
} from "@/lib/i18n/resolve-language";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/lib/i18n/types";
import type { Conversation, Database, Lead } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

const PERSIST_REASONS = new Set<LanguageResolutionReason>([
  "explicit_request",
  "explicit",
  "clear_current_message",
  "strong_current_message",
  "confident_switch",
  "strong_signals",
  "first_message_language",
]);

function hasStoredPreferredLanguage(
  preferredLanguage: string | null | undefined
): boolean {
  if (preferredLanguage == null || preferredLanguage.trim() === "") {
    return false;
  }

  return isSupportedLanguage(preferredLanguage);
}

/** Language for this reply — latest inbound message first, stored preference if ambiguous. */
export function resolveReplyLanguage(
  latestMessage: string,
  lead: Pick<Lead, "preferred_language" | "id">,
  history: Conversation[] = []
): SupportedLanguage {
  return resolveConversationLanguageDebug({
    latestMessage,
    leadPreferred: lead.preferred_language,
    leadId: lead.id,
    conversationHistory: history,
  }).finalLanguage;
}

export function resolveLanguageForLead(
  lead: Lead,
  latestMessage: string,
  history: Conversation[]
): SupportedLanguage {
  return resolveReplyLanguage(latestMessage, lead, history);
}

export async function syncLeadPreferredLanguage(
  supabase: Client,
  lead: Lead,
  latestMessage: string,
  history: Conversation[]
): Promise<Lead> {
  const debug = resolveConversationLanguageDebug({
    latestMessage,
    leadPreferred: lead.preferred_language,
    leadId: lead.id,
    conversationHistory: history,
  });
  const language = debug.finalLanguage;
  const hasStored = hasStoredPreferredLanguage(lead.preferred_language);

  if (
    isStabilityPatchV1Enabled() &&
    !PERSIST_REASONS.has(debug.reason) &&
    hasStored
  ) {
    return lead;
  }

  if (!isSupportedLanguage(language)) {
    return lead;
  }

  if (hasStored && language === normalizeLanguage(lead.preferred_language)) {
    return lead;
  }

  const { data, error } = await supabase
    .from("leads")
    .update({ preferred_language: language })
    .eq("id", lead.id)
    .select("*")
    .single();

  if (error) {
    console.error("[Language] Failed to update preferred_language", {
      leadId: lead.id,
      language,
      error: error.message,
    });
    return { ...lead, preferred_language: language };
  }

  console.log("[Language] Updated preferred_language", {
    leadId: lead.id,
    language,
    reason: debug.reason,
  });

  return data;
}

export function getLeadLanguage(lead: Pick<Lead, "preferred_language">): SupportedLanguage {
  return normalizeLanguage(lead.preferred_language ?? DEFAULT_LANGUAGE);
}
