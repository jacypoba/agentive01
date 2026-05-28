import { detectLanguageFromText } from "@/lib/i18n/detect-language";
import { resolveConversationLanguage } from "@/lib/i18n/resolve-language";
import { DEFAULT_LANGUAGE, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import type { Conversation, Database, Lead } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** Language for this reply — latest inbound message first, stored preference if ambiguous. */
export function resolveReplyLanguage(
  latestMessage: string,
  lead: Pick<Lead, "preferred_language">
): SupportedLanguage {
  return resolveConversationLanguage({
    latestMessage,
    leadPreferred: lead.preferred_language,
  });
}

export function resolveLanguageForLead(
  lead: Lead,
  latestMessage: string,
  _history: Conversation[]
): SupportedLanguage {
  return resolveReplyLanguage(latestMessage, lead);
}

export async function syncLeadPreferredLanguage(
  supabase: Client,
  lead: Lead,
  latestMessage: string,
  history: Conversation[]
): Promise<Lead> {
  const language = resolveLanguageForLead(lead, latestMessage, history);

  if (language === normalizeLanguage(lead.preferred_language)) {
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
  });

  return data;
}

export function getLeadLanguage(lead: Pick<Lead, "preferred_language">): SupportedLanguage {
  return normalizeLanguage(lead.preferred_language ?? DEFAULT_LANGUAGE);
}
