import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Conversation, Lead, Property } from "@/types/database";

const ORDINALS = ["A primeira", "A segunda", "A terceira", "A quarta"];

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
  property: Property
): string {
  const ordinal = index + 1;
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;

  const specs: string[] = [formatPropertyPrice(property.price)];
  if (property.bedrooms != null) {
    specs.push(`${property.bedrooms} quartos`);
  }
  if (property.bathrooms != null) {
    specs.push(`${property.bathrooms} wc`);
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
  history: Conversation[]
): string {
  const preferences = extractClientPreferences(lead, history);
  const preferenceLine =
    preferences.length > 0
      ? preferences.map((p) => PREFERENCE_LABELS[p]).join(", ")
      : "nenhuma preferência explícita detectada";

  const listings = properties
    .map((property, index) => formatPropertyComparisonLine(index, property))
    .join("\n\n");

  return [
    "Listagens enviadas (por ordem):",
    listings,
    "",
    "Preferências do cliente (CRM + conversa):",
    preferenceLine,
    lead.budget ? `Orçamento: ${lead.budget}` : null,
    lead.preferred_area ? `Zona: ${lead.preferred_area}` : null,
    lead.property_type ? `Tipo: ${lead.property_type}` : null,
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

function ordinalForIndex(index: number): string {
  return ORDINALS[index] ?? `A opção ${index + 1}`;
}

/** Rule-based fallback when AI is unavailable. */
export function buildHeuristicCatalogComparison(
  properties: Property[],
  preferences: ClientPreference[]
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
    observations.push(
      `${ordinalForIndex(cheapestIdx)} parece mais equilibrada pelo preço.`
    );
  }

  if (
    priciestIdx >= 0 &&
    priciestIdx !== cheapestIdx &&
    priceSpread >= 0.12 &&
    observations.length < 2
  ) {
    observations.push(
      `${ordinalForIndex(priciestIdx)} tem um perfil mais premium.`
    );
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

      const line =
        pref === "garden"
          ? `${ordinalForIndex(index)} pode fazer mais sentido se valoriza espaço exterior.`
          : pref === "modern"
            ? `${ordinalForIndex(index)} encaixa melhor para quem quer algo mais moderno.`
            : pref === "central"
              ? `${ordinalForIndex(index)} destaca-se pela localização mais central.`
              : pref === "family"
                ? `${ordinalForIndex(index)} parece a mais indicada para família — mais espaço.`
                : `${ordinalForIndex(index)} pode ser interessante a nível de investimento.`;

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
        `${ordinalForIndex(spaciousIdx)} destaca-se pelo espaço.`
      );
    }
  }

  if (observations.length === 0) {
    observations.push(
      `${ordinalForIndex(0)} encaixa bem no perfil geral.`,
      properties.length >= 2
        ? `${ordinalForIndex(1)} é uma alternativa sólida.`
        : ""
    );
  }

  return observations.filter(Boolean).slice(0, 2).join(" ");
}
