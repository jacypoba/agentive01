import { getProperties } from "@/lib/data/properties";
import {
  buildCityAlternativeSummary,
  type CityAlternativeSummary,
} from "@/lib/properties/city-alternatives";
import type { PropertySearchCriteria } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function findCityAlternativesForCriteria(
  supabase: Client,
  workspaceId: string,
  criteria: PropertySearchCriteria
): Promise<CityAlternativeSummary | null> {
  if (!criteria.city?.trim()) {
    return null;
  }

  const properties = await getProperties(supabase, workspaceId);
  return buildCityAlternativeSummary(properties, criteria);
}
