import { searchMatchingProperties } from "@/lib/data/properties";
import { derivePropertySearchCriteria } from "@/lib/properties/search-criteria";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  Database,
  Lead,
  Property,
  PropertySearchCriteria,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export type FindPropertyRecommendationsResult = {
  properties: Property[];
  criteria: PropertySearchCriteria | null;
};

async function searchWithCriteria(
  supabase: Client,
  userId: string,
  criteria: PropertySearchCriteria,
  limit: number
): Promise<Property[]> {
  try {
    return await searchMatchingProperties(supabase, userId, criteria, limit);
  } catch (error) {
    console.error("[Property recommendations] Search failed", {
      userId,
      criteria,
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
}

/**
 * Re-queries the database on every call. Uses strict criteria first, then
 * relaxed (city + type, budget optional) when strict is incomplete or empty.
 */
export async function findPropertyRecommendations(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  limit = 20,
  options?: { preferLatestMessage?: boolean }
): Promise<FindPropertyRecommendationsResult> {
  const searchOptions = { preferLatestMessage: options?.preferLatestMessage };
  const strictCriteria = derivePropertySearchCriteria(lead, history, searchOptions);
  let criteria = strictCriteria;
  let properties: Property[] = [];

  if (strictCriteria) {
    properties = await searchWithCriteria(
      supabase,
      lead.user_id,
      strictCriteria,
      limit
    );
  }

  if (!strictCriteria || properties.length === 0) {
    const relaxedCriteria = derivePropertySearchCriteria(lead, history, {
      relaxed: true,
      preferLatestMessage: options?.preferLatestMessage,
    });
    if (relaxedCriteria) {
      const relaxedResults = await searchWithCriteria(
        supabase,
        lead.user_id,
        relaxedCriteria,
        limit
      );
      if (relaxedResults.length > 0 || !criteria) {
        properties = relaxedResults;
        criteria = relaxedCriteria;
      }
    }
  }

  return { properties, criteria };
}
