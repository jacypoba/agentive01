import { citiesMatch, normalizeCity, propertyTypesMatch } from "@/lib/properties/normalize-search";
import {
  polishConversationalReply,
  withConversationalOpener,
} from "@/lib/ai/conversation-quality-v1";
import { completeLanguageRecord, type SupportedLanguage } from "@/lib/i18n/types";
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
    const pair = completeLanguageRecord({
      pt: " e ",
      it: " e ",
      en: " and ",
      es: " y ",
      fr: " et ",
    });
    return `${cities[0]}${pair[language]}${cities[1]}`;
  }

  const separator = completeLanguageRecord({
    pt: ", ",
    it: ", ",
    en: ", ",
    es: ", ",
    fr: ", ",
  });
  const lastJoin = completeLanguageRecord({
    pt: " e ",
    it: " e ",
    en: " and ",
    es: " y ",
    fr: " et ",
  });
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
    const onlyCity = completeLanguageRecord({
      pt: `Tenho opções em ${cityPhrase}.`,
      it: `Ho opzioni a ${cityPhrase}.`,
      en: `I have options in ${cityPhrase}.`,
      es: `Tengo opciones en ${cityPhrase}.`,
      fr: `J'ai des options à ${cityPhrase}.`,
    });
    return onlyCity[language];
  }

  const withArea = completeLanguageRecord({
    pt: `Tenho opções em ${primaryCity}, incluindo a zona ${area}.`,
    it: `Ho opzioni a ${primaryCity}, inclusa la zona ${area}.`,
    en: `I have options in ${primaryCity}, including the ${area} area.`,
    es: `Tengo opciones en ${primaryCity}, incluida la zona ${area}.`,
    fr: `J'ai des options à ${primaryCity}, y compris le quartier ${area}.`,
  });
  return withArea[language];
}

export function buildCityAlternativeFallbackText(
  language: SupportedLanguage,
  summary: CityAlternativeSummary
): string {
  const seed = `${summary.requestedCity}:city-fallback`;

  const unavailable = completeLanguageRecord({
    pt: `neste momento não tenho nada em ${summary.requestedCity}`,
    it: `al momento non ho nulla a ${summary.requestedCity}`,
    en: `I don't have anything in ${summary.requestedCity} right now`,
    es: `de momento no tengo nada en ${summary.requestedCity}`,
    fr: `je n'ai rien à ${summary.requestedCity} pour le moment`,
  });

  const options = formatOptionsPhrase(language, summary);

  const closing = completeLanguageRecord({
    pt: " Quer que eu te mostre?",
    it: " Vuoi che te le mostri?",
    en: " Would you like me to show them?",
    es: " ¿Te las muestro?",
    fr: " Je vous les montre ?",
  });

  const opened = withConversationalOpener(
    unavailable[language],
    language,
    seed
  );
  const raw = `${opened}. ${options}${closing[language]}`;
  return polishConversationalReply(raw, language, seed);
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
