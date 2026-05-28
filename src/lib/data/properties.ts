import type { SupabaseClient } from "@supabase/supabase-js";
import { citiesMatch, propertyTypesMatch } from "@/lib/properties/normalize-search";
import type {
  Database,
  Property,
  PropertyInsert,
  PropertyUpdate,
  PropertySearchCriteria,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export async function getProperties(
  supabase: Client,
  userId: string
): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`);
  }

  return (data ?? []).map(normalizeProperty);
}

export async function getPropertyById(
  supabase: Client,
  userId: string,
  propertyId: string
): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch property: ${error.message}`);
  }

  return data ? normalizeProperty(data) : null;
}

export async function getPropertiesByIds(
  supabase: Client,
  userId: string,
  ids: string[]
): Promise<Property[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .in("id", ids);

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
  const { data, error } = await supabase
    .from("properties")
    .insert(property)
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
  userId: string,
  fields: PropertyUpdate
): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .update(fields)
    .eq("id", propertyId)
    .eq("user_id", userId)
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
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("user_id", userId);

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
  userId: string,
  criteria: PropertySearchCriteria,
  limit = 3
): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to search properties: ${error.message}`);
  }

  const properties = (data ?? []).map(normalizeProperty);

  return properties
    .filter((property) => propertyMatchesCriteria(property, criteria))
    .sort((a, b) => scoreProperty(b, criteria) - scoreProperty(a, criteria))
    .slice(0, limit);
}
