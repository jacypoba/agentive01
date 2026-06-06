import { citiesMatch, normalizeCity, propertyTypesMatch } from "@/lib/properties/normalize-search";
import type { SupportedLanguage } from "@/lib/i18n/types";
import type { Property, PropertySearchCriteria } from "@/types/database";

export type CityAlternativeSummary = {
  requestedCity: string;
  availableCities: string[];
  availableAreas: string[];
  primaryCity: string;
  primaryAreas: string[];
};

export function filterAlternativeProperties(
  properties: Property[],
  criteria: PropertySearchCriteria
): Property[] {
  return properties.filter((property) => {
    if (criteria.city) {
      const inRequestedCity =
        citiesMatch(criteria.city, property.city) ||
        (property.neighborhood?.trim() &&
          citiesMatch(criteria.city, property.neighborhood));
      if (inRequestedCity) {
        return false;
      }
    }

    if (
      criteria.propertyType &&
      !propertyTypesMatch(criteria.propertyType, property.property_type)
    ) {
      return false;
    }

    if (criteria.maxBudget != null && property.price > criteria.maxBudget) {
      return false;
    }

    return true;
  });
}

export function summarizeAlternativeLocations(
  properties: Property[],
  requestedCity: string
): Omit<CityAlternativeSummary, "requestedCity"> | null {
  if (properties.length === 0) {
    return null;
  }

  const cityCounts = new Map<string, number>();
  for (const property of properties) {
    const city = normalizeCity(property.city) ?? property.city?.trim();
    if (!city) {
      continue;
    }
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }

  const availableCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city);

  if (availableCities.length === 0) {
    return null;
  }

  const primaryCity = availableCities[0]!;

  const primaryAreas = [
    ...new Set(
      properties
        .filter((property) => citiesMatch(primaryCity, property.city))
        .map((property) => property.neighborhood?.trim())
        .filter(
          (area): area is string =>
            Boolean(area) &&
            !citiesMatch(primaryCity, area) &&
            !citiesMatch(requestedCity, area)
        )
    ),
  ];

  const availableAreas = [
    ...new Set(
      properties
        .map((property) => property.neighborhood?.trim())
        .filter(
          (area): area is string =>
            Boolean(area) &&
            !availableCities.some((city) => citiesMatch(city, area)) &&
            !citiesMatch(requestedCity, area)
        )
    ),
  ];

  return {
    availableCities,
    availableAreas,
    primaryCity,
    primaryAreas,
  };
}

export function buildCityAlternativeSummary(
  properties: Property[],
  criteria: PropertySearchCriteria
): CityAlternativeSummary | null {
  if (!criteria.city?.trim()) {
    return null;
  }

  const requestedCity = normalizeCity(criteria.city) ?? criteria.city.trim();
  const alternatives = filterAlternativeProperties(properties, criteria);
  const summary = summarizeAlternativeLocations(alternatives, requestedCity);

  if (!summary) {
    return null;
  }

  return {
    requestedCity,
    ...summary,
  };
}

function joinCityList(language: SupportedLanguage, cities: string[]): string {
  if (cities.length === 0) {
    return "";
  }
  if (cities.length === 1) {
    return cities[0]!;
  }
  if (cities.length === 2) {
    const pair: Record<SupportedLanguage, string> = {
      pt: " e ",
      it: " e ",
      en: " and ",
      es: " y ",
    };
    return `${cities[0]}${pair[language]}${cities[1]}`;
  }

  const separator: Record<SupportedLanguage, string> = {
    pt: ", ",
    it: ", ",
    en: ", ",
    es: ", ",
  };
  const lastJoin: Record<SupportedLanguage, string> = {
    pt: " e ",
    it: " e ",
    en: " and ",
    es: " y ",
  };
  return `${cities.slice(0, -1).join(separator[language])}${lastJoin[language]}${cities.at(-1)}`;
}

function formatOptionsPhrase(
  language: SupportedLanguage,
  summary: CityAlternativeSummary
): string {
  const { primaryCity, primaryAreas, availableCities } = summary;
  const cityPhrase =
    availableCities.length <= 2
      ? joinCityList(language, availableCities)
      : primaryCity;

  const area = primaryAreas[0] ?? summary.availableAreas[0];
  if (!area) {
    const onlyCity: Record<SupportedLanguage, string> = {
      pt: `Tenho opções em ${cityPhrase}.`,
      it: `Ho opzioni a ${cityPhrase}.`,
      en: `I have options in ${cityPhrase}.`,
      es: `Tengo opciones en ${cityPhrase}.`,
    };
    return onlyCity[language];
  }

  const withArea: Record<SupportedLanguage, string> = {
    pt: `Tenho opções em ${primaryCity}, incluindo a zona ${area}.`,
    it: `Ho opzioni a ${primaryCity}, inclusa la zona ${area}.`,
    en: `I have options in ${primaryCity}, including the ${area} area.`,
    es: `Tengo opciones en ${primaryCity}, incluida la zona ${area}.`,
  };
  return withArea[language];
}

export function buildCityAlternativeFallbackText(
  language: SupportedLanguage,
  summary: CityAlternativeSummary
): string {
  const intro: Record<SupportedLanguage, string> = {
    pt: `Neste momento não tenho imóveis disponíveis em ${summary.requestedCity}. `,
    it: `Al momento non ho immobili disponibili a ${summary.requestedCity}. `,
    en: `Right now I don't have listings available in ${summary.requestedCity}. `,
    es: `De momento no tengo inmuebles disponibles en ${summary.requestedCity}. `,
  };

  const options = formatOptionsPhrase(language, summary);

  const closing: Record<SupportedLanguage, string> = {
    pt: " Quer que eu te mostre essas alternativas?",
    it: " Vuoi che ti mostri queste alternative?",
    en: " Would you like me to show those alternatives?",
    es: " ¿Quieres que te muestre esas alternativas?",
  };

  return `${intro[language]}${options}${closing[language]}`;
}

export function logCityAlternativeFallback(
  summary: CityAlternativeSummary,
  leadId: string,
  language: SupportedLanguage
): void {
  console.log("[Property fallback] city_no_match_available_alternatives", {
    requestedCity: summary.requestedCity,
    availableCities: summary.availableCities,
    availableAreas: summary.availableAreas,
    leadId,
    language,
  });
}
