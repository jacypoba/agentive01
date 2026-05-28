import type { SupabaseClient } from "@supabase/supabase-js";
import { detectLanguageFromText } from "@/lib/i18n/detect-language";
import { DEFAULT_LANGUAGE, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import type { Conversation, Database, Lead } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Language for this reply — always from the latest inbound message first. */
export function resolveReplyLanguage(
  latestMessage: string,
  lead: Pick<Lead, "preferred_language">
): SupportedLanguage {
  const stored = normalizeLanguage(lead.preferred_language);
  if (!latestMessage.trim()) {
    return stored;
  }
  return detectLanguageFromText(latestMessage, stored);
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
