import type { SupabaseClient } from "@supabase/supabase-js";
import { citiesMatch, propertyTypesMatch } from "@/lib/properties/normalize-search";
import { resolveWorkspaceIdForInsert } from "@/lib/workspaces/resolve-workspace-id-for-insert";
import type {
  Database,
  Property,
  PropertyInsert,
  PropertyUpdate,
  PropertySearchCriteria,
} from "@/types/database";

type Client = SupabaseClient<Database>;

function workspaceFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  workspaceId: string
): T {
  return query.eq("workspace_id", workspaceId);
}

export async function getProperties(
  supabase: Client,
  workspaceId: string
): Promise<Property[]> {
  const { data, error } = await workspaceFilter(
    supabase.from("properties").select("*"),
    workspaceId
  ).order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`);
  }

  return (data ?? []).map(normalizeProperty);
}

export async function countProperties(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const { count, error } = await workspaceFilter(
    supabase.from("properties").select("*", { count: "exact", head: true }),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to count properties: ${error.message}`);
  }

  return count ?? 0;
}

export async function getPropertyById(
  supabase: Client,
  workspaceId: string,
  propertyId: string
): Promise<Property | null> {
  const { data, error } = await workspaceFilter(
    supabase.from("properties").select("*").eq("id", propertyId),
    workspaceId
  ).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch property: ${error.message}`);
  }

  return data ? normalizeProperty(data) : null;
}

export async function getPropertiesByIds(
  supabase: Client,
  workspaceId: string,
  ids: string[]
): Promise<Property[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await workspaceFilter(
    supabase.from("properties").select("*").in("id", ids),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`);
  }

  const byId = new Map(
    (data ?? []).map((item) => [item.id, normalizeProperty(item)])
  );

  return ids
    .map((id) => byId.get(id))
    .filter((item): item is Property => item != null);
}

export async function createProperty(
  supabase: Client,
  property: PropertyInsert
): Promise<Property> {
  const workspaceId = await resolveWorkspaceIdForInsert(supabase, {
    userId: property.user_id,
    workspaceId: property.workspace_id,
  });

  const { data, error } = await supabase
    .from("properties")
    .insert({
      ...property,
      workspace_id: workspaceId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create property: ${error.message}`);
  }

  return normalizeProperty(data);
}

export async function updateProperty(
  supabase: Client,
  propertyId: string,
  workspaceId: string,
  fields: PropertyUpdate
): Promise<Property> {
  const { data, error } = await workspaceFilter(
    supabase.from("properties").update(fields).eq("id", propertyId),
    workspaceId
  )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update property: ${error.message}`);
  }

  return normalizeProperty(data);
}

export async function deleteProperty(
  supabase: Client,
  propertyId: string,
  workspaceId: string
): Promise<void> {
  const { error } = await workspaceFilter(
    supabase.from("properties").delete().eq("id", propertyId),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to delete property: ${error.message}`);
  }
}

function normalizeProperty(row: Property): Property {
  return {
    ...row,
    price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
  };
}

function propertyMatchesCriteria(
  property: Property,
  criteria: PropertySearchCriteria
): boolean {
  if (criteria.city) {
    const neighborhood = property.neighborhood?.trim() ?? "";
    const locationMatch =
      citiesMatch(criteria.city, property.city) ||
      (neighborhood.length > 0 && citiesMatch(criteria.city, neighborhood));
    if (!locationMatch) {
      return false;
    }
  }

  if (criteria.propertyType) {
    if (!propertyTypesMatch(criteria.propertyType, property.property_type)) {
      return false;
    }
  }

  if (criteria.maxBudget != null && property.price > criteria.maxBudget) {
    return false;
  }

  return true;
}

function scoreProperty(property: Property, criteria: PropertySearchCriteria): number {
  let score = 0;

  if (criteria.city) {
    if (citiesMatch(criteria.city, property.city)) {
      score += 30;
    } else if (
      property.neighborhood &&
      citiesMatch(criteria.city, property.neighborhood)
    ) {
      score += 20;
    }
  }

  if (criteria.maxBudget != null) {
    const headroom = criteria.maxBudget - property.price;
    if (headroom >= 0) {
      score += Math.min(25, 10 + headroom / criteria.maxBudget);
    }
  }

  if (
    criteria.propertyType &&
    propertyTypesMatch(criteria.propertyType, property.property_type)
  ) {
    score += 20;
  }

  return score;
}

export async function searchMatchingProperties(
  supabase: Client,
  workspaceId: string,
  criteria: PropertySearchCriteria,
  limit = 3
): Promise<Property[]> {
  const { data, error } = await workspaceFilter(
    supabase.from("properties").select("*"),
    workspaceId
  ).order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to search properties: ${error.message}`);
  }

  const properties = (data ?? []).map(normalizeProperty);

  return properties
    .filter((property) => propertyMatchesCriteria(property, criteria))
    .sort((a, b) => scoreProperty(b, criteria) - scoreProperty(a, criteria))
    .slice(0, limit);
}
