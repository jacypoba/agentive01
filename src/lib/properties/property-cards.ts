import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Conversation, Property } from "@/types/database";

const CARD_MARKER = "🏡";
const IMAGE_MARKER = "📷";
const LISTING_MARKER = "🔗 Ver detalhes";
const CATALOG_SPACER = "—";

export const CATALOG_MAX = 4;
export const CATALOG_MIN = 2;

/** Image carries the visual — title lives in the text card only. */
export function formatPropertyImageCaption(_property: Property): string {
  return "";
}

/** Premium property card for CRM and WhatsApp — no image URL, no raw listing URL. */
export function formatPropertyCard(property: Property): string {
  const blocks: string[] = [`${CARD_MARKER} ${property.title}`, ...buildPropertyDetailLines(property)];

  if (hasPropertyListing(property)) {
    blocks.push("", LISTING_MARKER);
  }

  return blocks.join("\n");
}

export function formatPropertyDetails(property: Property): string {
  return buildPropertyDetailLines(property).join("\n");
}

export function formatCatalogSpacer(): string {
  return CATALOG_SPACER;
}

/** Saved in conversation history for dedup; includes URL and property ID. */
export function formatPropertyListingRecord(property: Property): string | null {
  const listingUrl = property.listing_url?.trim();
  if (!listingUrl) {
    return `[property:${property.id}]`;
  }
  return `${LISTING_MARKER}\n${listingUrl}\n[property:${property.id}]`;
}

export function formatPropertyListingLabel(): string {
  return LISTING_MARKER;
}

function buildPropertyDetailLines(property: Property): string[] {
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;

  const lines: string[] = ["", `💰 ${formatPropertyPrice(property.price)}`];

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
    lines.push("", truncateDescription(property.description.trim()));
  }

  return lines;
}

function truncateDescription(description: string, maxLength = 100): string {
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength - 1).trim()}…`;
}

export function wasPropertyAlreadySent(
  history: Conversation[],
  property: Property
): boolean {
  const idMarker = `[property:${property.id}]`;

  return history.some((item) => {
    if (item.sender !== "ai" && item.sender !== "agent") {
      return false;
    }

    const message = item.message;
    if (message.includes(idMarker)) {
      return true;
    }

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

export function getShownPropertyIds(history: Conversation[]): Set<string> {
  const ids = new Set<string>();
  for (const item of history) {
    if (item.sender !== "ai" && item.sender !== "agent") {
      continue;
    }
    const matches = item.message.matchAll(/\[property:([a-f0-9-]+)\]/gi);
    for (const match of matches) {
      if (match[1]) ids.add(match[1]);
    }
  }
  return ids;
}

/** Most recently recommended property in conversation (for visit context). */
export function getLastShownPropertyId(history: Conversation[]): string | null {
  let lastId: string | null = null;
  for (const item of history) {
    if (item.sender !== "ai" && item.sender !== "agent") {
      continue;
    }
    const matches = [...item.message.matchAll(/\[property:([a-f0-9-]+)\]/gi)];
    const final = matches.at(-1)?.[1];
    if (final) lastId = final;
  }
  return lastId;
}

/** Property IDs from the most recent recommendation turn (before the latest client message). */
export function getLastShownPropertyBatchIds(history: Conversation[]): string[] {
  if (history.length === 0) {
    return [];
  }

  let scanEnd = history.length - 1;
  if (history[scanEnd]?.sender === "client") {
    scanEnd -= 1;
  }

  const ids: string[] = [];

  for (let i = scanEnd; i >= 0; i -= 1) {
    const item = history[i];
    if (item.sender === "client") {
      break;
    }

    for (const match of item.message.matchAll(/\[property:([a-f0-9-]+)\]/gi)) {
      const id = match[1];
      if (id && !ids.includes(id)) {
        ids.unshift(id);
      }
    }
  }

  return ids;
}

function hashPick(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

const RESHOW_CATALOG_INTROS = [
  "Claro — volto a enviar 👇",
  "Estas foram as opções 👇",
  "Sem problema — mando outra vez 👇",
  "Aqui estão outra vez 👇",
];

const RESHOW_SINGLE_INTROS = [
  "Claro — esta era a opção 👇",
  "Volto a enviar 👇",
  "Aqui está outra vez 👇",
];

export function buildReshowIntroText(seed: string, propertyCount: number): string {
  const variants =
    propertyCount === 1 ? RESHOW_SINGLE_INTROS : RESHOW_CATALOG_INTROS;
  return variants[hashPick(seed, variants.length)];
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
      "Tenho mais opções semelhantes, se quiser ver depois.",
      "Há mais no mesmo perfil.",
    ];
    return withMore[Math.floor(Math.random() * withMore.length)];
  }

  if (Math.random() < 0.45) {
    return null;
  }

  const singleMatch = [
    "Esta encaixa bem no perfil.",
    "Acho que faz sentido para o que pediu.",
  ];
  return singleMatch[Math.floor(Math.random() * singleMatch.length)];
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
