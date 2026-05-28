import {
  CATALOG_CONTEXT_LABELS,
  getComparisonOrdinal,
  getHeuristicComparisonLine,
} from "@/lib/i18n/messages";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { normalizeLanguage } from "@/lib/i18n/types";
import {
  formatPropertyPriceForLanguage,
} from "@/lib/properties/search-criteria";
import type { Conversation, Lead, Property } from "@/types/database";

export type ClientPreference =
  | "garden"
  | "modern"
  | "central"
  | "family"
  | "investment";

const PREFERENCE_LABELS: Record<ClientPreference, string> = {
  garden: "espaço exterior / jardim",
  modern: "estilo moderno",
  central: "zona central",
  family: "família / espaço",
  investment: "investimento",
};

const PREFERENCE_PATTERNS: Record<ClientPreference, RegExp> = {
  garden:
    /\b(jardim|garden|exterior|terraço|terrace|varanda|pátio|quintal|espaço exterior)\b/i,
  modern:
    /\b(modern|moderno|contempor|design|renovad|minimal|minimalista|novo)\b/i,
  central:
    /\b(central|centro|centro histórico|prime|downtown|baixa|chiado|alfama)\b/i,
  family:
    /\b(família|family|filhos|crianças|escolas|espaço|ampl|quartos)\b/i,
  investment:
    /\b(investimento|investment|rentabilidade|rendimento|aluguer|yield|roi)\b/i,
};

export function extractClientPreferences(
  lead: Lead,
  history: Conversation[]
): ClientPreference[] {
  const clientText = history
    .filter((item) => item.sender === "client")
    .map((item) => item.message)
    .join("\n");

  const combined = [
    lead.interest,
    lead.preferred_area,
    lead.property_type,
    lead.budget,
    clientText,
  ]
    .filter(Boolean)
    .join("\n");

  return (Object.keys(PREFERENCE_PATTERNS) as ClientPreference[]).filter(
    (pref) => PREFERENCE_PATTERNS[pref].test(combined)
  );
}

export function formatPropertyComparisonLine(
  index: number,
  property: Property,
  language: SupportedLanguage = "pt"
): string {
  const labels = CATALOG_CONTEXT_LABELS[language];
  const ordinal = index + 1;
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;

  const specs: string[] = [formatPropertyPriceForLanguage(property.price, language)];
  if (property.bedrooms != null) {
    specs.push(`${property.bedrooms} ${labels.bedrooms}`);
  }
  if (property.bathrooms != null) {
    specs.push(`${property.bathrooms} ${labels.bathrooms}`);
  }

  const description = property.description?.trim();
  const descriptionSnippet = description
    ? description.length > 100
      ? `${description.slice(0, 99).trim()}…`
      : description
    : null;

  return [
    `${ordinal}. "${property.title}" (${property.property_type})`,
    `   ${specs.join(" · ")} · ${location}`,
    descriptionSnippet ? `   ${descriptionSnippet}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCatalogComparisonContext(
  properties: Property[],
  lead: Lead,
  history: Conversation[],
  language: SupportedLanguage = normalizeLanguage(lead.preferred_language)
): string {
  const labels = CATALOG_CONTEXT_LABELS[language];
  const preferences = extractClientPreferences(lead, history);
  const preferenceLine =
    preferences.length > 0
      ? preferences.map((p) => PREFERENCE_LABELS[p]).join(", ")
      : labels.noPreferences;

  const listings = properties
    .map((property, index) =>
      formatPropertyComparisonLine(index, property, language)
    )
    .join("\n\n");

  return [
    labels.listingsHeader,
    listings,
    "",
    labels.preferencesHeader,
    preferenceLine,
    lead.budget ? `${labels.budget}: ${lead.budget}` : null,
    lead.preferred_area ? `${labels.area}: ${lead.preferred_area}` : null,
    lead.property_type ? `${labels.type}: ${lead.property_type}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

type PropertySignals = {
  garden: boolean;
  modern: boolean;
  central: boolean;
  spacious: boolean;
};

function getPropertySignals(property: Property): PropertySignals {
  const text = [
    property.title,
    property.description,
    property.neighborhood,
    property.property_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    garden: PREFERENCE_PATTERNS.garden.test(text),
    modern: PREFERENCE_PATTERNS.modern.test(text),
    central: PREFERENCE_PATTERNS.central.test(text),
    spacious: (property.bedrooms ?? 0) >= 3,
  };
}

/** Rule-based fallback when AI is unavailable. */
export function buildHeuristicCatalogComparison(
  properties: Property[],
  preferences: ClientPreference[],
  language: SupportedLanguage = "pt"
): string {
  if (properties.length < 2) return "";

  const observations: string[] = [];
  const sortedByPrice = [...properties].sort((a, b) => a.price - b.price);
  const cheapest = sortedByPrice[0];
  const priciest = sortedByPrice[sortedByPrice.length - 1];
  const cheapestIdx = properties.indexOf(cheapest);
  const priciestIdx = properties.indexOf(priciest);

  const priceSpread =
    cheapest.price > 0
      ? (priciest.price - cheapest.price) / cheapest.price
      : 0;

  if (priceSpread >= 0.08 && cheapestIdx >= 0) {
    const maxBeds = Math.max(...properties.map((p) => p.bedrooms ?? 0));
    const spaciousIdx = properties.findIndex(
      (p) => (p.bedrooms ?? 0) === maxBeds && maxBeds >= 3
    );
    const ordinal = getComparisonOrdinal(language, cheapestIdx);
    if (spaciousIdx === cheapestIdx && maxBeds >= 3) {
      observations.push(
        getHeuristicComparisonLine(language, "balanced_space", ordinal)
      );
    } else {
      observations.push(
        getHeuristicComparisonLine(language, "balanced_price", ordinal)
      );
    }
  }

  if (
    priciestIdx >= 0 &&
    priciestIdx !== cheapestIdx &&
    priceSpread >= 0.12 &&
    observations.length < 2
  ) {
    const signals = getPropertySignals(properties[priciestIdx]);
    const ordinal = getComparisonOrdinal(language, priciestIdx);
    if (signals.garden && signals.modern) {
      observations.push(
        getHeuristicComparisonLine(language, "premium_garden_modern", ordinal)
      );
    } else if (signals.garden) {
      observations.push(
        getHeuristicComparisonLine(language, "premium_garden", ordinal)
      );
    } else {
      observations.push(
        getHeuristicComparisonLine(language, "premium_profile", ordinal)
      );
    }
  }

  for (const pref of preferences) {
    if (observations.length >= 2) break;

    for (let index = 0; index < properties.length; index++) {
      const signals = getPropertySignals(properties[index]);
      const matches =
        (pref === "garden" && signals.garden) ||
        (pref === "modern" && signals.modern) ||
        (pref === "central" && signals.central) ||
        (pref === "family" && signals.spacious) ||
        (pref === "investment" &&
          properties[index].price === cheapest.price &&
          priceSpread >= 0.1);

      if (!matches) continue;

      const ordinal = getComparisonOrdinal(language, index);
      const key =
        pref === "garden"
          ? "pref_garden"
          : pref === "modern"
            ? "pref_modern"
            : pref === "central"
              ? "pref_central"
              : pref === "family"
                ? "pref_family"
                : "pref_investment";

      const line = getHeuristicComparisonLine(language, key, ordinal);
      if (!observations.includes(line)) {
        observations.push(line);
        break;
      }
    }
  }

  if (observations.length === 0) {
    const maxBeds = Math.max(...properties.map((p) => p.bedrooms ?? 0));
    const spaciousIdx = properties.findIndex(
      (p) => (p.bedrooms ?? 0) === maxBeds && maxBeds >= 3
    );
    if (spaciousIdx >= 0 && properties.length >= 2) {
      observations.push(
        getHeuristicComparisonLine(
          language,
          "spacious",
          getComparisonOrdinal(language, spaciousIdx)
        )
      );
    }
  }

  if (observations.length === 0) {
    observations.push(
      getHeuristicComparisonLine(
        language,
        "fits_profile",
        getComparisonOrdinal(language, 0)
      ),
      properties.length >= 2
        ? getHeuristicComparisonLine(
            language,
            "solid_alternative",
            getComparisonOrdinal(language, 1)
          )
        : ""
    );
  }

  return observations.filter(Boolean).slice(0, 2).join("\n");
}
