import type { SupabaseClient } from "@supabase/supabase-js";
import { detectLanguageFromHistory } from "@/lib/i18n/detect-language";
import { normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import type { Conversation, Database, Lead } from "@/types/database";

type Client = SupabaseClient<Database>;

export function resolveLanguageForLead(
  lead: Lead,
  latestMessage: string,
  history: Conversation[]
): SupportedLanguage {
  const stored = normalizeLanguage(lead.preferred_language);
  return detectLanguageFromHistory(history, latestMessage, stored);
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
  return normalizeLanguage(lead.preferred_language);
}
