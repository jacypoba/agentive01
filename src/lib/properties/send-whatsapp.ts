import {
  sendWhatsAppMedia,
  sendWhatsAppText,
} from "@/lib/evolution/client";
import {
  formatPropertyImageCaption,
  hasPropertyImage,
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
    }
  | {
      kind: "property_details";
      text: string;
      property: Property;
    };

export async function sendOutboundWhatsAppMessages(
  phoneDigits: string,
  messages: OutboundWhatsAppMessage[],
  instance?: string
): Promise<void> {
  for (const message of messages) {
    if (message.kind === "property_image") {
      console.log(
        "[WhatsApp debug] property_image image_url:",
        message.property.image_url
      );
      const imageUrl = message.property.image_url?.trim();
      if (!imageUrl) {
        continue;
      }

      await sendWhatsAppMedia(
        phoneDigits,
        {
          mediatype: "image",
          media: imageUrl,
          caption: formatPropertyImageCaption(message.property),
          mimetype: guessImageMimeType(imageUrl),
          fileName: buildImageFileName(message.property),
        },
        instance
      );
      continue;
    }

    await sendWhatsAppText(phoneDigits, message.text, instance);
  }
}

export function buildPropertyOutboundMessages(
  property: Property,
  detailsText: string
): OutboundWhatsAppMessage[] {
  const messages: OutboundWhatsAppMessage[] = [];

  if (hasPropertyImage(property)) {
    messages.push({ kind: "property_image", property });
  }

  messages.push({
    kind: "property_details",
    text: detailsText,
    property,
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
