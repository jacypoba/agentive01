import {
  sendWhatsAppMedia,
  sendWhatsAppText,
} from "@/lib/evolution/client";
import { isPropertyCardMessage } from "@/lib/properties/property-cards";
import type { Property } from "@/types/database";

export type OutboundWhatsAppMessage = {
  text: string;
  property?: Property;
};

export async function sendOutboundWhatsAppMessages(
  phoneDigits: string,
  messages: OutboundWhatsAppMessage[],
  instance?: string
): Promise<void> {
  for (const message of messages) {
    const property = message.property;
    const imageUrl = property?.image_url?.trim();

    if (property && isPropertyCardMessage(message.text) && imageUrl) {
      await sendWhatsAppMedia(
        phoneDigits,
        {
          mediatype: "image",
          media: imageUrl,
          caption: message.text,
          mimetype: guessImageMimeType(imageUrl),
          fileName: buildImageFileName(property),
        },
        instance
      );
      continue;
    }

    await sendWhatsAppText(phoneDigits, message.text, instance);
  }
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
