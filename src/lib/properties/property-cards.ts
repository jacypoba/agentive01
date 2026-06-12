import { escapeRegex, foldKey } from "@/lib/properties/city-aliases";
import {
  buildReshowIntroText as buildLocalizedReshowIntro,
  LISTING_LABELS,
  PROPERTY_CARD_LABELS,
} from "@/lib/i18n/messages";
import { getLanguageLocale, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import { formatPropertyPriceForLanguage } from "@/lib/properties/search-criteria";
import type { Conversation, Property } from "@/types/database";

const CARD_MARKER = "🏡";
const IMAGE_MARKER = "📷";
const CATALOG_SPACER = "—";

export const CATALOG_MAX = 4;
export const CATALOG_MIN = 2;

type NonPortugueseLanguage = Exclude<SupportedLanguage, "pt">;

const EXACT_DISPLAY_TITLES: Record<
  NonPortugueseLanguage,
  Record<string, string>
> = {
  fr: {
    "moradia com jardim": "Maison avec jardin",
  },
  it: {
    "moradia com jardim": "Casa con giardino",
  },
  en: {
    "moradia com jardim": "House with garden",
  },
  es: {
    "moradia com jardim": "Casa con jardín",
  },
};

/** Longest phrase first — partial CRM title localization at render time. */
const DISPLAY_TITLE_PHRASES: Record<
  NonPortugueseLanguage,
  readonly { from: string; to: string }[]
> = {
  fr: [
    { from: "Moradia com jardim", to: "Maison avec jardin" },
    { from: "com jardim", to: "avec jardin" },
    { from: "Apartamento", to: "Appartement" },
    { from: "Moradia", to: "Maison" },
    { from: "Casa", to: "Maison" },
  ],
  it: [
    { from: "Moradia com jardim", to: "Casa con giardino" },
    { from: "com jardim", to: "con giardino" },
    { from: "Apartamento", to: "Appartamento" },
    { from: "Moradia", to: "Casa" },
    { from: "Casa", to: "Casa" },
  ],
  en: [
    { from: "Moradia com jardim", to: "House with garden" },
    { from: "com jardim", to: "with garden" },
    { from: "Apartamento", to: "Apartment" },
    { from: "Moradia", to: "House" },
    { from: "Casa", to: "House" },
  ],
  es: [
    { from: "Moradia com jardim", to: "Casa con jardín" },
    { from: "com jardim", to: "con jardín" },
    { from: "Apartamento", to: "Apartamento" },
    { from: "Moradia", to: "Casa" },
    { from: "Casa", to: "Casa" },
  ],
};

/** Localized listing title for outbound cards — never mutates property.title. */
export function formatPropertyDisplayTitle(
  property: Property,
  language: SupportedLanguage = "pt"
): string {
  const source = property.title?.trim() ?? "";
  if (!source) {
    return source;
  }

  const lang = normalizeLanguage(language);
  if (lang === "pt") {
    return source;
  }

  const exact = EXACT_DISPLAY_TITLES[lang][foldKey(source)];
  if (exact) {
    return exact;
  }

  let result = source;
  for (const { from, to } of DISPLAY_TITLE_PHRASES[lang]) {
    const pattern = new RegExp(escapeRegex(from), "gi");
    if (pattern.test(result)) {
      result = result.replace(pattern, to);
    }
  }

  return result === source ? source : result;
}

export function getListingMarker(language: SupportedLanguage): string {
  return LISTING_LABELS[normalizeLanguage(language)];
}

export function getAllListingMarkers(): string[] {
  return Object.values(LISTING_LABELS);
}

/** Image carries the visual — title lives in the text card only. */
export function formatPropertyImageCaption(_property: Property): string {
  return "";
}

/** Premium property card for CRM and WhatsApp — no image URL, no raw listing URL. */
export function formatPropertyCard(
  property: Property,
  language: SupportedLanguage = "pt"
): string {
  const lang = normalizeLanguage(language);
  const blocks: string[] = [
    `${CARD_MARKER} ${formatPropertyDisplayTitle(property, lang)}`,
    ...buildPropertyDetailLines(property, lang),
  ];

  if (hasPropertyListing(property)) {
    blocks.push("", getListingMarker(lang));
  }

  return blocks.join("\n");
}

export function formatPropertyDetails(
  property: Property,
  language: SupportedLanguage = "pt"
): string {
  return buildPropertyDetailLines(property, normalizeLanguage(language)).join("\n");
}

export function formatCatalogSpacer(): string {
  return CATALOG_SPACER;
}

/** Saved in conversation history for dedup; includes URL and property ID. */
export function formatPropertyListingRecord(
  property: Property,
  language: SupportedLanguage = "pt"
): string | null {
  const listingUrl = property.listing_url?.trim();
  const marker = getListingMarker(normalizeLanguage(language));
  if (!listingUrl) {
    return `[property:${property.id}]`;
  }
  return `${marker}\n${listingUrl}\n[property:${property.id}]`;
}

export function formatPropertyListingLabel(language: SupportedLanguage = "pt"): string {
  return getListingMarker(normalizeLanguage(language));
}

/** Contextual listing line for WhatsApp — avoids naked URLs. */
export function formatPropertyListingLine(
  language: SupportedLanguage,
  listingUrl: string
): string {
  const url = listingUrl.trim();
  if (!url) {
    return "";
  }
  return `${getListingMarker(normalizeLanguage(language))}: ${url}`;
}

/** Property card text for WhatsApp outbound, including listing URL when present. */
export function formatPropertyWhatsAppPackageText(
  property: Property,
  language: SupportedLanguage = "pt"
): string {
  const lang = normalizeLanguage(language);
  const card = formatPropertyCard(property, lang);
  const listingUrl = property.listing_url?.trim();

  if (!listingUrl || !hasPropertyListing(property)) {
    return card;
  }

  if (card.includes(listingUrl)) {
    return card;
  }

  const marker = getListingMarker(lang);
  const listingLine = formatPropertyListingLine(lang, listingUrl);

  if (card.endsWith(marker)) {
    return `${card.slice(0, card.length - marker.length).trimEnd()}\n${listingLine}`;
  }

  return `${card}\n${listingLine}`;
}

function buildPropertyDetailLines(
  property: Property,
  language: SupportedLanguage
): string[] {
  const labels = PROPERTY_CARD_LABELS[language];
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;

  const lines: string[] = [
    "",
    `💰 ${formatPropertyPriceForLanguage(property.price, language)}`,
  ];

  const roomParts: string[] = [];
  if (property.bedrooms != null) {
    roomParts.push(
      `${property.bedrooms} ${property.bedrooms === 1 ? labels.bedroom : labels.bedrooms}`
    );
  }
  if (property.bathrooms != null) {
    roomParts.push(
      `${property.bathrooms} ${property.bathrooms === 1 ? labels.bathroom : labels.bathrooms}`
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
  const listingMarkers = getAllListingMarkers();

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

    if (
      listingMarkers.some((marker) => message.includes(marker)) &&
      message.includes(property.title)
    ) {
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

export function buildReshowIntroText(
  language: SupportedLanguage,
  seed: string,
  propertyCount: number
): string {
  return buildLocalizedReshowIntro(normalizeLanguage(language), seed, propertyCount);
}

export function selectNextPropertyToRecommend(
  properties: Property[],
  history: Conversation[]
): Property | null {
  const batch = selectPropertiesForCatalog(properties, history);
  return batch[0] ?? null;
}

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

export function isPropertyCardMessage(message: string): boolean {
  return message.startsWith(CARD_MARKER) && !message.startsWith(IMAGE_MARKER);
}

export function hasPropertyImage(property: Property): boolean {
  return Boolean(property.image_url?.trim());
}

export function hasPropertyListing(property: Property): boolean {
  return Boolean(property.listing_url?.trim());
}

export { getLanguageLocale };
