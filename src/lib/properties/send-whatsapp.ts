import { sendWhatsAppText } from "@/lib/evolution/client";
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
      console.log("[MEDIA DISABLED - TEXT ONLY]");
      console.log(
        "[MEDIA DISABLED - TEXT ONLY] Skipped property_image:",
        message.property.image_url
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
  return [
    {
      kind: "property_details",
      text: detailsText,
      property,
    },
  ];
}
