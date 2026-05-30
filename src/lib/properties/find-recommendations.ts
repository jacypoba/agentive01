import { searchMatchingProperties } from "@/lib/data/properties";
import {
  derivePropertySearchCriteria,
  derivePropertySearchDebug,
} from "@/lib/properties/search-criteria";
import { normalizeSearchCriteria } from "@/lib/properties/normalize-search";
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
  workspaceId: string,
  criteria: PropertySearchCriteria,
  limit: number
): Promise<Property[]> {
  const normalized = normalizeSearchCriteria(criteria);

  try {
    return await searchMatchingProperties(supabase, workspaceId, normalized, limit);
  } catch (error) {
    console.error("[Property search] Query failed", {
      userId: workspaceId,
      criteria: normalized,
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

  const workspaceId = lead.workspace_id;
  if (!workspaceId) {
    return { properties: [], criteria: null };
  }

  const strictDebug = derivePropertySearchDebug(lead, history, searchOptions);
  let criteria = strictDebug.criteria;
  let properties: Property[] = [];

  console.log("[Property search] Normalized input", {
    leadId: lead.id,
    rawUserInput: strictDebug.rawUserInput,
    normalizedPropertyType: strictDebug.normalizedPropertyType,
    normalizedCity: strictDebug.normalizedCity,
    normalizedBudget: strictDebug.normalizedBudget,
    mode: "strict",
  });

  if (strictDebug.criteria) {
    properties = await searchWithCriteria(
      supabase,
      workspaceId,
      strictDebug.criteria,
      limit
    );
    console.log("[Property search] Strict query result", {
      leadId: lead.id,
      matchedPropertiesCount: properties.length,
    });
  }

  if (!strictDebug.criteria || properties.length === 0) {
    const relaxedDebug = derivePropertySearchDebug(lead, history, {
      ...searchOptions,
      relaxed: true,
    });

    console.log("[Property search] Normalized input", {
      leadId: lead.id,
      rawUserInput: relaxedDebug.rawUserInput,
      normalizedPropertyType: relaxedDebug.normalizedPropertyType,
      normalizedCity: relaxedDebug.normalizedCity,
      normalizedBudget: relaxedDebug.normalizedBudget,
      mode: "relaxed",
    });

    if (relaxedDebug.criteria) {
      const relaxedResults = await searchWithCriteria(
        supabase,
        workspaceId,
        relaxedDebug.criteria,
        limit
      );

      console.log("[Property search] Relaxed query result", {
        leadId: lead.id,
        matchedPropertiesCount: relaxedResults.length,
      });

      if (relaxedResults.length > 0 || !criteria) {
        properties = relaxedResults;
        criteria = relaxedDebug.criteria;
      }
    }
  }

  return { properties, criteria };
}
