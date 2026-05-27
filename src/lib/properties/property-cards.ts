import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Conversation, Property } from "@/types/database";

const CARD_MARKER = "🏡";
const IMAGE_MARKER = "📷";
const LISTING_MARKER = "🔗 Ver detalhes";

export function formatPropertyImageCaption(property: Property): string {
  return property.title;
}

/** Clean property card for CRM and WhatsApp text — no image URL, no raw listing URL. */
export function formatPropertyCard(property: Property): string {
  const lines = [`${CARD_MARKER} ${property.title}`, ...buildPropertyDetailLines(property)];
  return lines.join("\n");
}

export function formatPropertyDetails(property: Property): string {
  return buildPropertyDetailLines(property).join("\n");
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

function truncateDescription(description: string, maxLength = 140): string {
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
  for (const property of properties) {
    if (!wasPropertyAlreadySent(history, property)) {
      return property;
    }
  }
  return null;
}

export function buildPropertyFollowUpText(): string {
  const options = [
    "Esta parece encaixar bastante no que procura 👌",
    "Acho que esta faz sentido para o que descreveu.",
    "Parece-me uma boa match — diz-me o que pensa.",
    "Esta tinha mesmo o perfil que mencionou.",
    "Curiosa para saber o que acha desta 🙂",
  ];
  return options[Math.floor(Math.random() * options.length)];
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
