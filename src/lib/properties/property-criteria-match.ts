import { citiesMatch, propertyTypesMatch } from "@/lib/properties/normalize-search";
import type { Property, PropertySearchCriteria } from "@/types/database";

export type PropertyCriteriaBlockReason =
  | "city_mismatch"
  | "neighborhood_mismatch"
  | "budget_exceeded"
  | "property_type_mismatch";

export function getPropertyCriteriaBlockReason(
  property: Property,
  criteria: PropertySearchCriteria
): PropertyCriteriaBlockReason | null {
  if (criteria.city?.trim()) {
    const neighborhood = property.neighborhood?.trim() ?? "";
    const locationMatch =
      citiesMatch(criteria.city, property.city) ||
      (neighborhood.length > 0 && citiesMatch(criteria.city, neighborhood));
    if (!locationMatch) {
      return "city_mismatch";
    }
  }

  if (criteria.neighborhood?.trim()) {
    const target = criteria.neighborhood.trim();
    const neighborhood = property.neighborhood?.trim() ?? "";
    if (!neighborhood || !citiesMatch(target, neighborhood)) {
      return "neighborhood_mismatch";
    }
  }

  if (criteria.maxBudget != null && property.price > criteria.maxBudget) {
    return "budget_exceeded";
  }

  if (criteria.propertyType?.trim()) {
    if (!propertyTypesMatch(criteria.propertyType, property.property_type)) {
      return "property_type_mismatch";
    }
  }

  return null;
}

export function propertyMatchesCriteria(
  property: Property,
  criteria: PropertySearchCriteria
): boolean {
  return getPropertyCriteriaBlockReason(property, criteria) === null;
}
