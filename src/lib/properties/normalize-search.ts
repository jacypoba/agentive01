/** Canonical internal values for language-independent property search. */

import type { PropertySearchCriteria } from "@/types/database";
import {
  foldKey,
  escapeRegex,
  normalizeCity,
  normalizePropertyType,
  PROPERTY_TYPE_ALIAS_KEYS,
  PROPERTY_TYPE_ALIASES,
} from "@/lib/properties/city-aliases";
import { extractTargetCityFromMessage } from "@/lib/properties/extract-target-city";

export { normalizeCity, normalizePropertyType } from "@/lib/properties/city-aliases";

export {
  extractTargetCityFromMessage,
  extractAllCityMentions,
  type TargetCityExtraction,
  type TargetCityConfidence,
  type CityMention,
} from "@/lib/properties/extract-target-city";

export type NormalizedPropertySearch = {
  rawUserInput: string;
  normalizedCity: string | null;
  normalizedPropertyType: string | null;
  normalizedBudget: number | null;
  criteria: PropertySearchCriteria | null;
};

/** Extract target city from free text — handles pivot/rejection across multiple mentions. */
export function extractCityFromMessage(text: string): string | null {
  return extractTargetCityFromMessage(text).targetCity;
}

/** Extract property type from free text using multilingual alias map. */
export function extractPropertyTypeFromMessage(text: string): string | null {
  if (!text.trim()) return null;

  const folded = foldKey(text);
  for (const key of PROPERTY_TYPE_ALIAS_KEYS) {
    const pattern = new RegExp(`\\b${escapeRegex(key)}\\b`, "i");
    if (pattern.test(folded)) {
      return PROPERTY_TYPE_ALIASES[key];
    }
  }

  return null;
}

export function parseNormalizedBudget(
  budgetText: string | null | undefined
): number | null {
  if (!budgetText?.trim()) return null;

  const text = budgetText.toLowerCase().replace(/\s+/g, " ");

  const milhoesMatch = text.match(
    /(\d[\d.,]*)\s*(?:milh[oõ]es|milhão|million|m\b)(?!\w|il)/i
  );
  if (milhoesMatch) {
    const value = parseLocalizedNumber(milhoesMatch[1]);
    return value != null ? Math.round(value * 1_000_000) : null;
  }

  const thousandMatch = text.match(
    /(\d[\d.,]*)\s*(?:thousand|thousands)\b/i
  );
  if (thousandMatch) {
    const value = parseLocalizedNumber(thousandMatch[1]);
    return value != null ? Math.round(value * 1_000) : null;
  }

  const milaMatch = text.match(/(\d[\d.,]*)\s*mila(?:\s*(?:euro|eur|€))?/i);
  if (milaMatch) {
    const value = parseLocalizedNumber(milaMatch[1]);
    return value != null ? Math.round(value * 1_000) : null;
  }

  const milMatch = text.match(/(\d[\d.,]*)\s*(?:mil)\b/i);
  if (milMatch) {
    const value = parseLocalizedNumber(milMatch[1]);
    return value != null ? Math.round(value * 1_000) : null;
  }

  const kMatch = text.match(/(\d[\d.,]*)\s*k\b/i);
  if (kMatch) {
    const value = parseLocalizedNumber(kMatch[1]);
    return value != null ? Math.round(value * 1_000) : null;
  }

  const currencyMatch = text.match(/(\d[\d.,]{2,})/);
  if (currencyMatch) {
    const value = parseLocalizedNumber(currencyMatch[1]);
    if (value != null && value >= 10_000) {
      return Math.round(value);
    }
  }

  return null;
}

function parseLocalizedNumber(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  }

  if (cleaned.includes(",") && !cleaned.includes(".")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      const value = Number.parseFloat(`${parts[0]}.${parts[1]}`);
      return Number.isFinite(value) ? value : null;
    }
    const value = Number.parseFloat(cleaned.replace(/,/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    const value = Number.parseFloat(cleaned.replace(/\./g, ""));
    return Number.isFinite(value) ? value : null;
  }

  const value = Number.parseFloat(cleaned.replace(/\./g, ""));
  return Number.isFinite(value) ? value : null;
}

export function normalizeSearchCriteria(
  criteria: PropertySearchCriteria
): PropertySearchCriteria {
  return {
    city: normalizeCity(criteria.city) ?? criteria.city,
    propertyType:
      normalizePropertyType(criteria.propertyType) ?? criteria.propertyType,
    maxBudget: criteria.maxBudget,
    neighborhood: criteria.neighborhood?.trim() || undefined,
  };
}

export function buildNormalizedPropertySearch(input: {
  rawUserInput: string;
  city?: string | null;
  propertyType?: string | null;
  budgetText?: string | null;
  relaxed?: boolean;
}): NormalizedPropertySearch {
  const rawUserInput = input.rawUserInput.trim();
  const text = rawUserInput;

  const normalizedCity =
    normalizeCity(input.city) ??
    extractCityFromMessage(text) ??
    null;
  const normalizedPropertyType =
    normalizePropertyType(input.propertyType) ??
    extractPropertyTypeFromMessage(text) ??
    null;
  const normalizedBudget =
    parseNormalizedBudget(input.budgetText) ??
    parseNormalizedBudget(text) ??
    null;

  let criteria: PropertySearchCriteria | null = null;

  if (input.relaxed) {
    if (normalizedCity && normalizedPropertyType) {
      criteria = normalizeSearchCriteria({
        city: normalizedCity,
        propertyType: normalizedPropertyType,
        maxBudget: normalizedBudget ?? undefined,
      });
    }
  } else if (
    normalizedCity &&
    normalizedPropertyType &&
    normalizedBudget != null
  ) {
    criteria = normalizeSearchCriteria({
      city: normalizedCity,
      propertyType: normalizedPropertyType,
      maxBudget: normalizedBudget,
    });
  }

  return {
    rawUserInput,
    normalizedCity,
    normalizedPropertyType,
    normalizedBudget,
    criteria,
  };
}

export function citiesMatch(
  searchCity: string | null | undefined,
  propertyCity: string | null | undefined
): boolean {
  if (!searchCity?.trim() || !propertyCity?.trim()) return false;

  const normalizedSearch = foldKey(normalizeCity(searchCity) ?? searchCity);
  const normalizedProperty = foldKey(normalizeCity(propertyCity) ?? propertyCity);

  return (
    normalizedSearch === normalizedProperty ||
    normalizedSearch.includes(normalizedProperty) ||
    normalizedProperty.includes(normalizedSearch)
  );
}

export function propertyTypesMatch(
  searchType: string | null | undefined,
  propertyType: string | null | undefined
): boolean {
  if (!searchType?.trim() || !propertyType?.trim()) return false;

  const normalizedSearch = normalizePropertyType(searchType);
  const normalizedProperty = normalizePropertyType(propertyType);
  if (!normalizedSearch || !normalizedProperty) return false;

  if (normalizedSearch === normalizedProperty) return true;

  const foldedProperty = foldKey(propertyType);
  return (
    foldedProperty.includes(normalizedSearch) ||
    normalizedSearch.includes(foldedProperty)
  );
}
