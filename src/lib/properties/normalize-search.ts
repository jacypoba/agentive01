/** Canonical internal values for language-independent property search. */

import type { PropertySearchCriteria } from "@/types/database";

const CITY_ALIASES: Record<string, string> = {
  milan: "Milano",
  milano: "Milano",
  milão: "Milano",
  milao: "Milano",
  lisbon: "Lisboa",
  lisboa: "Lisboa",
  porto: "Porto",
  florence: "Firenze",
  firenze: "Firenze",
  rome: "Roma",
  roma: "Roma",
  madrid: "Madrid",
  barcelona: "Barcelona",
  paris: "Paris",
  london: "London",
  cascais: "Cascais",
  sintra: "Sintra",
  oeiras: "Oeiras",
  faro: "Faro",
  coimbra: "Coimbra",
  braga: "Braga",
};

const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  villa: "moradia",
  house: "moradia",
  home: "moradia",
  townhouse: "moradia",
  townhome: "moradia",
  casa: "moradia",
  moradia: "moradia",
  vivenda: "moradia",
  villetta: "moradia",
  vivienda: "moradia",
  chalet: "moradia",
  apartment: "apartamento",
  appartamento: "apartamento",
  apartamento: "apartamento",
  flat: "apartamento",
  condo: "apartamento",
  condominium: "apartamento",
  loft: "apartamento",
  duplex: "apartamento",
  penthouse: "apartamento",
  estúdio: "apartamento",
  estudio: "apartamento",
  studio: "apartamento",
  t0: "apartamento",
  t1: "apartamento",
  t2: "apartamento",
  t3: "apartamento",
  t4: "apartamento",
};

const CITY_ALIAS_KEYS = Object.keys(CITY_ALIASES).sort(
  (a, b) => b.length - a.length
);
const TYPE_ALIAS_KEYS = Object.keys(PROPERTY_TYPE_ALIASES).sort(
  (a, b) => b.length - a.length
);

export type NormalizedPropertySearch = {
  rawUserInput: string;
  normalizedCity: string | null;
  normalizedPropertyType: string | null;
  normalizedBudget: number | null;
  criteria: PropertySearchCriteria | null;
};

function foldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPropertyTypeToken(value: string): boolean {
  const folded = foldKey(value);
  return TYPE_ALIAS_KEYS.some(
    (key) => folded === key || folded.includes(key) || key.includes(folded)
  );
}

export function normalizeCity(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const folded = foldKey(value);
  const canonical = CITY_ALIASES[folded];
  if (canonical) return canonical;

  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizePropertyType(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const folded = foldKey(value);
  return PROPERTY_TYPE_ALIASES[folded] ?? value.trim().toLowerCase();
}

/** Extract city from free text — known aliases first, avoids "a villa" false positives. */
export function extractCityFromMessage(text: string): string | null {
  if (!text.trim()) return null;

  const folded = foldKey(text);
  for (const key of CITY_ALIAS_KEYS) {
    const pattern = new RegExp(`\\b${escapeRegex(key)}\\b`, "i");
    if (pattern.test(folded)) {
      return CITY_ALIASES[key];
    }
  }

  const prepositionMatch = text.match(
    /\b(?:em|in|en|near|around|at)\s+([a-zA-ZÀ-ú]+(?:\s+[a-zA-ZÀ-ú]+)?)/i
  );
  if (prepositionMatch?.[1]) {
    const candidate = prepositionMatch[1].trim();
    if (!isPropertyTypeToken(candidate)) {
      return normalizeCity(candidate);
    }
  }

  return null;
}

/** Extract property type from free text using multilingual alias map. */
export function extractPropertyTypeFromMessage(text: string): string | null {
  if (!text.trim()) return null;

  const folded = foldKey(text);
  for (const key of TYPE_ALIAS_KEYS) {
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
