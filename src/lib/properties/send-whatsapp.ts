import {
  sendWhatsAppMediaSafe,
  sendWhatsAppTextSafe,
} from "@/lib/evolution/client";
import {
  formatCatalogSpacer,
  formatPropertyImageCaption,
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

export type OutboundSendFailure = {
  kind: OutboundWhatsAppMessage["kind"] | "property_package";
  propertyId?: string;
  error: string;
};

export type OutboundSendReport = {
  attempted: number;
  sent: number;
  failed: number;
  failures: OutboundSendFailure[];
};

export async function sendOutboundWhatsAppMessages(
  phoneDigits: string,
  messages: OutboundWhatsAppMessage[],
  instance?: string,
  remoteJid?: string
): Promise<OutboundSendReport> {
  const report: OutboundSendReport = {
    attempted: 0,
    sent: 0,
    failed: 0,
    failures: [],
  };

  const deliveredPropertyText = new Set<string>();

  for (const message of messages) {
    if (message.kind === "catalog_spacer") {
      await deliverText(phoneDigits, formatCatalogSpacer(), instance, report, "catalog_spacer", undefined, remoteJid);
      continue;
    }

    if (message.kind === "property_image") {
      const delivered = await deliverPropertyPackage(
        phoneDigits,
        message.property,
        message.fallbackText,
        instance,
        report,
        remoteJid
      );
      if (delivered) {
        deliveredPropertyText.add(message.property.id);
      }
      continue;
    }

    if (message.kind === "property_details") {
      if (deliveredPropertyText.has(message.property.id)) {
        continue;
      }
      const delivered = await deliverText(
        phoneDigits,
        message.text,
        instance,
        report,
        "property_details",
        message.property.id,
        remoteJid
      );
      if (delivered) {
        deliveredPropertyText.add(message.property.id);
      }
      continue;
    }

    if (message.kind === "property_listing") {
      if (deliveredPropertyText.has(message.property.id)) {
        continue;
      }
      await deliverLink(phoneDigits, message.url, instance, report, message.property.id, remoteJid);
      continue;
    }

    await deliverText(phoneDigits, message.text, instance, report, "text", undefined, remoteJid);
  }

  if (report.failed > 0) {
    console.warn("[WHATSAPP OUTBOUND] Completed with failures", report);
  }

  return report;
}

async function deliverPropertyPackage(
  phoneDigits: string,
  property: Property,
  fallbackText: string,
  instance: string | undefined,
  report: OutboundSendReport,
  remoteJid?: string
): Promise<boolean> {
  const imageUrl = property.image_url?.trim() ?? "";
  const listingUrl = property.listing_url?.trim() ?? "";
  const textCard = buildPropertyTextFallback(fallbackText, listingUrl);
  const plainSummary = buildPlainPropertySummary(property);

  if (imageUrl && isValidOutboundUrl(imageUrl)) {
    report.attempted += 1;
    const caption = formatPropertyImageCaption(property);
    const mediaResult = await sendWhatsAppMediaSafe(
      phoneDigits,
      {
        mediatype: "image",
        media: imageUrl,
        ...(caption ? { caption } : {}),
        mimetype: guessImageMimeType(imageUrl),
        fileName: buildImageFileName(property),
      },
      { instance, remoteJid }
    );

    if (mediaResult.sentToWhatsApp) {
      report.sent += 1;

      if (listingUrl && isValidOutboundUrl(listingUrl)) {
        await deliverLink(phoneDigits, listingUrl, instance, report, property.id, remoteJid);
      }

      return true;
    }

    report.failed += 1;
    report.failures.push({
      kind: "property_image",
      propertyId: property.id,
      error:
        mediaResult.error ??
        mediaResult.warning ??
        (mediaResult.pendingOnly
          ? "Image accepted by Evolution but WhatsApp delivery is PENDING."
          : "Image send failed."),
    });
  } else if (imageUrl) {
    console.warn("[WHATSAPP OUTBOUND] Invalid property image URL, skipping media", {
      propertyId: property.id,
      imageUrl,
    });
  }

  if (await deliverText(phoneDigits, textCard, instance, report, "property_details", property.id, remoteJid)) {
    return true;
  }

  return deliverText(phoneDigits, plainSummary, instance, report, "property_package", property.id, remoteJid);
}

async function deliverText(
  phoneDigits: string,
  text: string,
  instance: string | undefined,
  report: OutboundSendReport,
  kind: OutboundSendFailure["kind"],
  propertyId?: string,
  remoteJid?: string
): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  report.attempted += 1;
  const result = await sendWhatsAppTextSafe(phoneDigits, trimmed, { instance, remoteJid });

  if (result.sentToWhatsApp) {
    report.sent += 1;
    return true;
  }

  report.failed += 1;
  report.failures.push({
    kind,
    propertyId,
    error:
      result.error ??
      result.warning ??
      (result.pendingOnly
        ? "Evolution accepted the text but WhatsApp delivery is PENDING."
        : "Text send failed."),
  });
  return false;
}

async function deliverLink(
  phoneDigits: string,
  url: string,
  instance: string | undefined,
  report: OutboundSendReport,
  propertyId?: string,
  remoteJid?: string
): Promise<boolean> {
  const trimmed = url.trim();
  if (!trimmed || !isValidOutboundUrl(trimmed)) {
    report.failed += 1;
    report.failures.push({
      kind: "property_listing",
      propertyId,
      error: "Invalid listing URL.",
    });
    return false;
  }

  console.log("[WHATSAPP OUTBOUND LINK]", {
    propertyId,
    url: trimmed,
  });

  report.attempted += 1;
  const result = await sendWhatsAppTextSafe(phoneDigits, trimmed, { instance, remoteJid });

  if (result.sentToWhatsApp) {
    report.sent += 1;
    console.log("[WHATSAPP OUTBOUND SUCCESS]", { kind: "link", propertyId });
    return true;
  }

  report.failed += 1;
  report.failures.push({
    kind: "property_listing",
    propertyId,
    error:
      result.error ??
      result.warning ??
      (result.pendingOnly
        ? "Evolution accepted the link but WhatsApp delivery is PENDING."
        : "Link send failed."),
  });
  console.error("[WHATSAPP OUTBOUND FAILURE]", {
    kind: "link",
    propertyId,
    reason: result.error ?? result.warning,
  });
  return false;
}

export function buildPropertyOutboundMessages(
  property: Property,
  detailsText: string
): OutboundWhatsAppMessage[] {
  const messages: OutboundWhatsAppMessage[] = [];

  if (hasPropertyImage(property) && isValidOutboundUrl(property.image_url?.trim() ?? "")) {
    messages.push({
      kind: "property_image",
      property,
      fallbackText: detailsText,
    });
  } else {
    messages.push({
      kind: "property_details",
      text: buildPropertyTextFallback(
        detailsText,
        property.listing_url?.trim() ?? ""
      ),
      property,
    });
  }

  const listingUrl = property.listing_url?.trim();
  if (
    hasPropertyListing(property) &&
    listingUrl &&
    isValidOutboundUrl(listingUrl) &&
    hasPropertyImage(property)
  ) {
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
  const messages: OutboundWhatsAppMessage[] = [];

  properties.forEach((property, index) => {
    const detailsText = detailsTexts[index] ?? "";

    messages.push(...buildPropertyOutboundMessages(property, detailsText));

    if (index < properties.length - 1) {
      messages.push({ kind: "catalog_spacer" });
    }
  });

  return messages;
}

function buildPropertyTextFallback(detailsText: string, listingUrl: string): string {
  const parts = [detailsText.trim()];
  const url = listingUrl.trim();

  if (url && isValidOutboundUrl(url) && !detailsText.includes(url)) {
    parts.push("", url);
  }

  return parts.filter(Boolean).join("\n");
}

function buildPlainPropertySummary(property: Property): string {
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;
  const listing = property.listing_url?.trim();

  const lines = [`${property.title}`, location ? `📍 ${location}` : null];

  if (listing && isValidOutboundUrl(listing)) {
    lines.push(listing);
  }

  return lines.filter(Boolean).join("\n");
}

export function isValidOutboundUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
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
