import {
  sendWhatsAppMedia,
  sendWhatsAppText,
} from "@/lib/evolution/client";
import {
  formatCatalogSpacer,
  formatPropertyImageCaption,
  formatPropertyListingLabel,
  hasPropertyImage,
  hasPropertyListing,
} from "@/lib/properties/property-cards";
import type { Property } from "@/types/database";

export type OutboundWhatsAppMessage =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "property_image";
      property: Property;
      fallbackText: string;
      catalogIndex?: number;
      catalogTotal?: number;
    }
  | {
      kind: "property_details";
      text: string;
      property: Property;
    }
  | {
      kind: "property_listing";
      property: Property;
      url: string;
    }
  | {
      kind: "catalog_spacer";
    };

export async function sendOutboundWhatsAppMessages(
  phoneDigits: string,
  messages: OutboundWhatsAppMessage[],
  instance?: string
): Promise<void> {
  const textFallbackPropertyIds = new Set<string>();

  for (const message of messages) {
    if (message.kind === "catalog_spacer") {
      await sendWhatsAppText(phoneDigits, formatCatalogSpacer(), instance);
      continue;
    }

    if (message.kind === "property_image") {
      const imageUrl = message.property.image_url?.trim();
      if (!imageUrl) {
        continue;
      }

      try {
        await sendWhatsAppMedia(
          phoneDigits,
          {
            mediatype: "image",
            media: imageUrl,
            caption: formatPropertyImageCaption(
              message.property,
              message.catalogIndex,
              message.catalogTotal
            ),
            mimetype: guessImageMimeType(imageUrl),
            fileName: buildImageFileName(message.property),
          },
          instance
        );
      } catch (error) {
        console.warn("[Property WhatsApp] Media send failed, using text fallback", {
          propertyId: message.property.id,
          imageUrl,
          error: error instanceof Error ? error.message : error,
        });
        await sendWhatsAppText(phoneDigits, message.fallbackText, instance);
        textFallbackPropertyIds.add(message.property.id);
      }
      continue;
    }

    if (message.kind === "property_details") {
      if (textFallbackPropertyIds.has(message.property.id)) {
        continue;
      }
      await sendWhatsAppText(phoneDigits, message.text, instance);
      continue;
    }

    if (message.kind === "property_listing") {
      await sendWhatsAppText(phoneDigits, formatPropertyListingLabel(), instance);
      await sendWhatsAppText(phoneDigits, message.url, instance);
      continue;
    }

    await sendWhatsAppText(phoneDigits, message.text, instance);
  }
}

export function buildPropertyOutboundMessages(
  property: Property,
  detailsText: string,
  catalogIndex?: number,
  catalogTotal?: number
): OutboundWhatsAppMessage[] {
  const messages: OutboundWhatsAppMessage[] = [];

  if (hasPropertyImage(property)) {
    messages.push({
      kind: "property_image",
      property,
      fallbackText: detailsText,
      catalogIndex,
      catalogTotal,
    });
  }

  messages.push({
    kind: "property_details",
    text: detailsText,
    property,
  });

  const listingUrl = property.listing_url?.trim();
  if (hasPropertyListing(property) && listingUrl) {
    messages.push({
      kind: "property_listing",
      property,
      url: listingUrl,
    });
  }

  return messages;
}

export function buildCatalogOutboundMessages(
  properties: Property[],
  detailsTexts: string[]
): OutboundWhatsAppMessage[] {
  const catalogTotal = properties.length;
  const messages: OutboundWhatsAppMessage[] = [];

  properties.forEach((property, index) => {
    const catalogIndex = index + 1;
    const detailsText = detailsTexts[index] ?? "";

    messages.push(
      ...buildPropertyOutboundMessages(
        property,
        detailsText,
        catalogIndex,
        catalogTotal
      )
    );

    if (index < properties.length - 1) {
      messages.push({ kind: "catalog_spacer" });
    }
  });

  return messages;
}

function guessImageMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

function buildImageFileName(property: Property): string {
  const slug = property.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${slug || "property"}.jpg`;
}
