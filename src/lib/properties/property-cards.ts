import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Conversation, Property } from "@/types/database";

const CARD_MARKER = "🏡";
const IMAGE_MARKER = "📷";

export function formatPropertyImageCaption(property: Property): string {
  return `${CARD_MARKER} ${property.title}`;
}

export function formatPropertyCard(property: Property): string {
  const lines = [`${CARD_MARKER} ${property.title}`, ...buildPropertyDetailLines(property)];
  return lines.join("\n");
}

export function formatPropertyDetails(property: Property): string {
  return buildPropertyDetailLines(property).join("\n");
}

function buildPropertyDetailLines(property: Property): string[] {
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;

  const lines = [`💰 ${formatPropertyPrice(property.price)}`];

  if (property.bedrooms != null) {
    lines.push(
      `🛏 ${property.bedrooms} ${property.bedrooms === 1 ? "quarto" : "quartos"}`
    );
  }

  lines.push(`📍 ${location}`);

  if (property.description?.trim()) {
    lines.push(truncateDescription(property.description.trim()));
  }

  const listingUrl = property.listing_url?.trim();
  if (listingUrl) {
    lines.push("🔗 Ver detalhes:", listingUrl);
  }

  if (property.image_url?.trim()) {
    lines.push("🖼️ Foto:", property.image_url.trim());
  }

  return lines;
}

export function formatPropertyImageConversationRecord(property: Property): string {
  const imageUrl = property.image_url?.trim();
  if (!imageUrl) {
    return formatPropertyCard(property);
  }

  return `${IMAGE_MARKER} ${property.title}\n${imageUrl}`;
}

function truncateDescription(description: string, maxLength = 160): string {
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
  return "Gostava de saber o que acha desta opção? 🙂";
}

export function isPropertyCardMessage(message: string): boolean {
  return message.startsWith(CARD_MARKER) && !message.startsWith(IMAGE_MARKER);
}

export function hasPropertyImage(property: Property): boolean {
  return Boolean(property.image_url?.trim());
}
