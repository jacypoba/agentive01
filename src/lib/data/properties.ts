import type { SupabaseClient } from "@supabase/supabase-js";
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

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

function propertyMatchesCriteria(
  property: Property,
  criteria: PropertySearchCriteria
): boolean {
  const cityTerm = criteria.city ? normalizeSearchTerm(criteria.city) : null;
  const typeTerm = criteria.propertyType
    ? normalizeSearchTerm(criteria.propertyType)
    : null;

  if (cityTerm) {
    const city = normalizeSearchTerm(property.city);
    const neighborhood = property.neighborhood
      ? normalizeSearchTerm(property.neighborhood)
      : "";
    const locationMatch =
      city.includes(cityTerm) ||
      cityTerm.includes(city) ||
      neighborhood.includes(cityTerm) ||
      cityTerm.includes(neighborhood);
    if (!locationMatch) {
      return false;
    }
  }

  if (typeTerm) {
    const propertyType = normalizeSearchTerm(property.property_type);
    const typeMatch =
      propertyType.includes(typeTerm) ||
      typeTerm.includes(propertyType) ||
      typeAliasesMatch(typeTerm, propertyType);
    if (!typeMatch) {
      return false;
    }
  }

  if (criteria.maxBudget != null && property.price > criteria.maxBudget) {
    return false;
  }

  return true;
}

function typeAliasesMatch(search: string, propertyType: string): boolean {
  const apartmentTerms = ["apartamento", "apartment", "flat", "t0", "t1", "t2", "t3", "t4"];
  const houseTerms = ["moradia", "vivenda", "house", "villa"];

  const searchIsApartment = apartmentTerms.some((term) => search.includes(term));
  const searchIsHouse = houseTerms.some((term) => search.includes(term));
  const propertyIsApartment = apartmentTerms.some((term) =>
    propertyType.includes(term)
  );
  const propertyIsHouse = houseTerms.some((term) => propertyType.includes(term));

  if (searchIsApartment && propertyIsApartment) return true;
  if (searchIsHouse && propertyIsHouse) return true;

  return false;
}

function scoreProperty(property: Property, criteria: PropertySearchCriteria): number {
  let score = 0;

  if (criteria.city) {
    const cityTerm = normalizeSearchTerm(criteria.city);
    const city = normalizeSearchTerm(property.city);
    if (city === cityTerm) score += 30;
    else if (city.includes(cityTerm) || cityTerm.includes(city)) score += 20;
  }

  if (criteria.maxBudget != null) {
    const headroom = criteria.maxBudget - property.price;
    if (headroom >= 0) {
      score += Math.min(25, 10 + headroom / criteria.maxBudget);
    }
  }

  if (criteria.propertyType) {
    const typeTerm = normalizeSearchTerm(criteria.propertyType);
    const propertyType = normalizeSearchTerm(property.property_type);
    if (propertyType.includes(typeTerm) || typeTerm.includes(propertyType)) {
      score += 20;
    }
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
