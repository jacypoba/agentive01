import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Conversation, Property } from "@/types/database";

const CARD_MARKER = "🏡";

export function formatPropertyCard(property: Property): string {
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;

  const lines = [
    `${CARD_MARKER} ${property.title}`,
    `💰 ${formatPropertyPrice(property.price)}`,
  ];

  if (property.bedrooms != null) {
    lines.push(`🛏 ${property.bedrooms} ${property.bedrooms === 1 ? "quarto" : "quartos"}`);
  }

  lines.push(`📍 ${location}`);

  if (property.description?.trim()) {
    lines.push(truncateDescription(property.description.trim()));
  }

  if (property.listing_url?.trim()) {
    lines.push(`🔗 Ver detalhes: ${property.listing_url.trim()}`);
  }

  return lines.join("\n");
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

    return message.startsWith(CARD_MARKER) && message.includes(property.title);
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
  return message.startsWith(CARD_MARKER);
}
