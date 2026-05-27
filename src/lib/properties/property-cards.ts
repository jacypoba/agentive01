import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Conversation, Property } from "@/types/database";

const CARD_MARKER = "🏡";
const IMAGE_MARKER = "📷";
const LISTING_MARKER = "🔗 Ver detalhes";
const CATALOG_SPACER = "· · ·";

export const CATALOG_MAX = 4;
export const CATALOG_MIN = 2;

export function formatPropertyImageCaption(
  property: Property,
  catalogIndex?: number,
  catalogTotal?: number
): string {
  if (catalogTotal && catalogTotal > 1 && catalogIndex) {
    return `${catalogIndex}/${catalogTotal} · ${property.title}`;
  }
  return property.title;
}

/** Clean property card for CRM and WhatsApp text — no image URL, no raw listing URL. */
export function formatPropertyCard(
  property: Property,
  catalogIndex?: number,
  catalogTotal?: number
): string {
  const titleLines = [`${CARD_MARKER} ${property.title}`];
  if (catalogTotal && catalogTotal > 1 && catalogIndex) {
    titleLines.push(`${catalogIndex} / ${catalogTotal}`);
  }

  return [...titleLines, ...buildPropertyDetailLines(property)].join("\n");
}

export function formatPropertyDetails(property: Property): string {
  return buildPropertyDetailLines(property).join("\n");
}

export function formatCatalogSpacer(): string {
  return CATALOG_SPACER;
}

/** Saved in conversation history for dedup; includes URL for matching only. */
export function formatPropertyListingRecord(property: Property): string | null {
  const listingUrl = property.listing_url?.trim();
  if (!listingUrl) return null;
  return `${LISTING_MARKER}\n${listingUrl}`;
}

export function formatPropertyListingLabel(): string {
  return LISTING_MARKER;
}

function buildPropertyDetailLines(property: Property): string[] {
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;

  const lines = [`💰 ${formatPropertyPrice(property.price)}`];

  const roomParts: string[] = [];
  if (property.bedrooms != null) {
    roomParts.push(
      `${property.bedrooms} ${property.bedrooms === 1 ? "quarto" : "quartos"}`
    );
  }
  if (property.bathrooms != null) {
    roomParts.push(
      `${property.bathrooms} ${property.bathrooms === 1 ? "wc" : "wcs"}`
    );
  }
  if (roomParts.length > 0) {
    lines.push(`🛏 ${roomParts.join(" · ")}`);
  }

  lines.push(`📍 ${location}`);

  if (property.description?.trim()) {
    lines.push(truncateDescription(property.description.trim()));
  }

  return lines;
}

function truncateDescription(description: string, maxLength = 120): string {
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength - 1).trim()}…`;
}

export function wasPropertyAlreadySent(
  history: Conversation[],
  property: Property
): boolean {
  return history.some((item) => {
    if (item.sender !== "ai" && item.sender !== "agent") {
      return false;
    }

    const message = item.message;
    if (property.listing_url && message.includes(property.listing_url)) {
      return true;
    }

    if (property.image_url && message.includes(property.image_url)) {
      return true;
    }

    return (
      (message.startsWith(CARD_MARKER) || message.startsWith(IMAGE_MARKER)) &&
      message.includes(property.title)
    );
  });
}

export function selectNextPropertyToRecommend(
  properties: Property[],
  history: Conversation[]
): Property | null {
  const batch = selectPropertiesForCatalog(properties, history);
  return batch[0] ?? null;
}

/** Returns 2–4 unsent matches for a catalog, or 0–1 for single-property flow. */
export function selectPropertiesForCatalog(
  properties: Property[],
  history: Conversation[],
  maxCount = CATALOG_MAX
): Property[] {
  const unsent = properties.filter(
    (property) => !wasPropertyAlreadySent(history, property)
  );

  if (unsent.length <= 1) {
    return unsent;
  }

  return unsent.slice(0, Math.min(maxCount, unsent.length));
}

export function isCatalogBatch(properties: Property[]): boolean {
  return properties.length >= CATALOG_MIN;
}

export function getCatalogCityHint(properties: Property[]): string | null {
  const first = properties[0];
  if (!first) return null;
  return first.city?.trim() || first.neighborhood?.trim() || null;
}

export type PropertyFollowUpOptions = {
  hasMoreMatches: boolean;
  clientAskedForOptions: boolean;
};

/** Optional statement after a single property — never a question. Returns null to skip. */
export function buildPropertyFollowUpText(
  options: PropertyFollowUpOptions
): string | null {
  if (options.clientAskedForOptions) {
    return null;
  }

  if (options.hasMoreMatches) {
    const withMore = [
      "Tenho também outras opções semelhantes, se quiser ver depois.",
      "Esta foi a primeira — tenho mais no mesmo perfil.",
      "Esta encaixa bem no que pediu. Há mais no mesmo estilo.",
    ];
    return withMore[Math.floor(Math.random() * withMore.length)];
  }

  if (Math.random() < 0.45) {
    return null;
  }

  const singleMatch = [
    "Esta foi a melhor opção que encontrei dentro do perfil.",
    "Esta encaixa bem no que pediu.",
    "Acho que esta faz sentido para o perfil.",
  ];
  return singleMatch[Math.floor(Math.random() * singleMatch.length)];
}

export type CatalogClosingOptions = {
  clientAskedForOptions: boolean;
};

/** Soft closing after a full catalog — optional, never a question. */
export function buildCatalogClosingText(
  properties: Property[],
  options: CatalogClosingOptions
): string | null {
  if (options.clientAskedForOptions || properties.length < CATALOG_MIN) {
    return null;
  }

  if (Math.random() < 0.3) {
    return null;
  }

  const ordinals = ["A primeira", "A segunda", "A terceira", "A quarta"];
  const highlightIndex =
    properties.length >= 3 ? 1 : Math.floor(Math.random() * properties.length);
  const highlight = ordinals[highlightIndex] ?? "Esta";

  const closings = [
    `${highlight} parece encaixar bastante no perfil.`,
    "Qualquer uma destas pode fazer sentido — veja com calma.",
    `${highlight} é provavelmente a que mais se aproxima do que pediu.`,
    "São as que melhor encaixam no perfil de momento.",
  ];

  return closings[Math.floor(Math.random() * closings.length)];
}

export function isPropertyCardMessage(message: string): boolean {
  return message.startsWith(CARD_MARKER) && !message.startsWith(IMAGE_MARKER);
}

export function hasPropertyImage(property: Property): boolean {
  return Boolean(property.image_url?.trim());
}

export function hasPropertyListing(property: Property): boolean {
  return Boolean(property.listing_url?.trim());
}
