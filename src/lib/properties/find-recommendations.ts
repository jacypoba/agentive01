import { searchMatchingProperties } from "@/lib/data/properties";
import { derivePropertySearchCriteria } from "@/lib/properties/search-criteria";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Database, Lead, Property } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function findPropertyRecommendations(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  limit = 10
): Promise<Property[]> {
  const criteria = derivePropertySearchCriteria(lead, history);
  if (!criteria) {
    return [];
  }

  try {
    return await searchMatchingProperties(
      supabase,
      lead.user_id,
      criteria,
      limit
    );
  } catch (error) {
    console.error("[Property recommendations] Search failed", {
      leadId: lead.id,
      criteria,
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
}
