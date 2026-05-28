/** Canonical internal values for language-independent property search. */

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

function foldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
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

  const milaMatch = text.match(/(\d[\d.,]*)\s*mila(?:\s*(?:euro|eur|€))?/i);
  if (milaMatch) {
    const value = parseLocalizedNumber(milaMatch[1]);
    return value != null ? Math.round(value * 1_000) : null;
  }

  const milMatch = text.match(/(\d[\d.,]*)\s*(?:mil|k\b)/i);
  if (milMatch) {
    const value = parseLocalizedNumber(milMatch[1]);
    return value != null ? Math.round(value * 1_000) : null;
  }

  const bareKMatch = text.match(/(\d[\d.,]*)\s*k(?!\w)/i);
  if (bareKMatch) {
    const value = parseLocalizedNumber(bareKMatch[1]);
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
