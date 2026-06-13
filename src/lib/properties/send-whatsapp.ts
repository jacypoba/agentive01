import {
  sendWhatsAppMediaSafe,
  sendWhatsAppTextSafe,
} from "@/lib/whatsapp/send";
import {
  formatCatalogSpacer,
  formatPropertyDisplayTitle,
  formatPropertyImageCaption,
  formatPropertyListingLine,
  hasPropertyImage,
} from "@/lib/properties/property-cards";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { normalizeLanguage } from "@/lib/i18n/types";
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
      language?: SupportedLanguage;
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
      label?: string;
      language?: SupportedLanguage;
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

export type OutboundWhatsAppSendDeps = {
  sendMedia: typeof sendWhatsAppMediaSafe;
  sendText: typeof sendWhatsAppTextSafe;
};

const defaultOutboundSendDeps: OutboundWhatsAppSendDeps = {
  sendMedia: sendWhatsAppMediaSafe,
  sendText: sendWhatsAppTextSafe,
};

const PRICE_MARKERS = ["💰", "€", "EUR", "$", "£"];
const BEDROOM_MARKERS = [
  "bedroom",
  "bedrooms",
  "chambre",
  "chambres",
  "quarto",
  "quartos",
  "camere",
  "camera",
  "habitación",
  "habitaciones",
  "🛏",
];

function logPropertyOutboundDebug(input: {
  kind: OutboundSendFailure["kind"] | "property_image";
  sourceFunction: string;
  propertyId?: string;
  text?: string;
}): void {
  const text = input.text?.trim() ?? "";
  console.log("[Property Outbound Debug]", {
    kind: input.kind,
    sourceFunction: input.sourceFunction,
    propertyId: input.propertyId ?? null,
    containsPrice: PRICE_MARKERS.some((marker) => text.includes(marker)),
    containsBedrooms: BEDROOM_MARKERS.some((marker) =>
      text.toLowerCase().includes(marker.toLowerCase())
    ),
    containsListingUrl: /https?:\/\//i.test(text),
    textPreview: text.slice(0, 120),
  });
}

export async function sendOutboundWhatsAppMessages(
  phoneDigits: string,
  messages: OutboundWhatsAppMessage[],
  instance?: string,
  remoteJid?: string,
  deps: OutboundWhatsAppSendDeps = defaultOutboundSendDeps
): Promise<OutboundSendReport> {
  const report: OutboundSendReport = {
    attempted: 0,
    sent: 0,
    failed: 0,
    failures: [],
  };

  const deliveredPropertyText = new Set<string>();
  const deliveredPropertyBodies = new Map<string, string>();

  console.log("[Property Outbound Debug]", {
    phase: "queue",
    messageKinds: messages.map((message) => message.kind),
    sanitizedKinds: sanitizePropertyOutboundMessages(messages).map(
      (message) => message.kind
    ),
  });

  for (const message of sanitizePropertyOutboundMessages(messages)) {
    if (message.kind === "catalog_spacer") {
      await deliverText(
        phoneDigits,
        formatCatalogSpacer(),
        instance,
        report,
        "catalog_spacer",
        undefined,
        remoteJid,
        deps
      );
      continue;
    }

    if (message.kind === "property_image") {
      const textDeliveredViaFallback = await deliverPropertyImage(
        phoneDigits,
        message.property,
        message.fallbackText,
        message.language,
        instance,
        report,
        remoteJid,
        deps
      );
      if (textDeliveredViaFallback) {
        markPropertyTextDelivered(
          message.property.id,
          message.fallbackText,
          deliveredPropertyText,
          deliveredPropertyBodies
        );
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
        remoteJid,
        deps,
        "sendOutboundWhatsAppMessages.property_details"
      );
      if (delivered) {
        markPropertyTextDelivered(
          message.property.id,
          message.text,
          deliveredPropertyText,
          deliveredPropertyBodies
        );
      }
      continue;
    }

    if (message.kind === "property_listing") {
      if (
        shouldSkipPropertyListingMessage(
          message.property,
          deliveredPropertyText,
          deliveredPropertyBodies
        )
      ) {
        continue;
      }
      const linkText =
        message.label?.trim() ||
        formatPropertyListingLine(
          normalizeLanguage(message.language),
          message.url
        );
      await deliverText(
        phoneDigits,
        linkText,
        instance,
        report,
        "property_listing",
        message.property.id,
        remoteJid,
        deps,
        "sendOutboundWhatsAppMessages.property_listing"
      );
      continue;
    }

    await deliverText(
      phoneDigits,
      message.text,
      instance,
      report,
      "text",
      undefined,
      remoteJid,
      deps,
      "sendOutboundWhatsAppMessages.text"
    );
  }

  if (report.failed > 0) {
    console.warn("[WHATSAPP OUTBOUND] Completed with failures", report);
  }

  return report;
}

/** Sends property image only; returns true if fallback text was attempted (image failed). */
async function deliverPropertyImage(
  phoneDigits: string,
  property: Property,
  fallbackText: string,
  language: SupportedLanguage | undefined,
  instance: string | undefined,
  report: OutboundSendReport,
  remoteJid: string | undefined,
  deps: OutboundWhatsAppSendDeps
): Promise<boolean> {
  const lang = normalizeLanguage(language);
  const imageUrl = property.image_url?.trim() ?? "";
  const hasPackageTextCard = Boolean(fallbackText.trim());
  const textCard = hasPackageTextCard
    ? fallbackText.trim()
    : buildPlainPropertySummary(property, lang);

  if (imageUrl && isValidOutboundUrl(imageUrl)) {
    logPropertyOutboundDebug({
      kind: "property_image",
      sourceFunction: "deliverPropertyImage",
      propertyId: property.id,
      text: textCard,
    });

    report.attempted += 1;
    const caption = formatPropertyImageCaption(property);
    const mediaResult = await deps.sendMedia(
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
      return false;
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

  if (!textCard) {
    return false;
  }

  const textKind = hasPackageTextCard ? "property_details" : "property_package";
  const sourceFunction = hasPackageTextCard
    ? "deliverPropertyImage.textCard"
    : "deliverPropertyImage.plainSummary";

  logPropertyOutboundDebug({
    kind: textKind,
    sourceFunction,
    propertyId: property.id,
    text: textCard,
  });

  await deliverText(
    phoneDigits,
    textCard,
    instance,
    report,
    textKind,
    property.id,
    remoteJid,
    deps,
    sourceFunction
  );

  // Package textCard was attempted — never chain plainSummary afterward.
  // Return true so queued property_details is skipped (avoids duplicate cards
  // when the provider ack is false but the message still reaches the client).
  return true;
}

async function deliverText(
  phoneDigits: string,
  text: string,
  instance: string | undefined,
  report: OutboundSendReport,
  kind: OutboundSendFailure["kind"],
  propertyId: string | undefined,
  remoteJid: string | undefined,
  deps: OutboundWhatsAppSendDeps,
  sourceFunction = "deliverText"
): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  logPropertyOutboundDebug({
    kind,
    sourceFunction,
    propertyId,
    text: trimmed,
  });

  report.attempted += 1;
  const result = await deps.sendText(phoneDigits, trimmed, { instance, remoteJid });

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

export function propertyPackageIncludesListingUrl(
  text: string,
  property: Property
): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  const listingUrl = property.listing_url?.trim();
  if (!listingUrl || !isValidOutboundUrl(listingUrl)) {
    return false;
  }

  return trimmed.includes(listingUrl);
}

/** Drop redundant property_listing rows when the card/details already carry the URL. */
export function sanitizePropertyOutboundMessages(
  messages: OutboundWhatsAppMessage[]
): OutboundWhatsAppMessage[] {
  const detailsIncludeListingByProperty = new Map<string, boolean>();

  for (const message of messages) {
    if (message.kind === "property_details") {
      detailsIncludeListingByProperty.set(
        message.property.id,
        propertyPackageIncludesListingUrl(message.text, message.property) ||
          detailsIncludeListingByProperty.get(message.property.id) === true
      );
      continue;
    }

    if (message.kind === "property_image") {
      if (propertyPackageIncludesListingUrl(message.fallbackText, message.property)) {
        detailsIncludeListingByProperty.set(message.property.id, true);
      }
    }
  }

  return messages.filter((message) => {
    if (message.kind !== "property_listing") {
      return true;
    }

    return detailsIncludeListingByProperty.get(message.property.id) !== true;
  });
}

function markPropertyTextDelivered(
  propertyId: string,
  text: string,
  deliveredPropertyText: Set<string>,
  deliveredPropertyBodies: Map<string, string>
): void {
  deliveredPropertyText.add(propertyId);
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const prior = deliveredPropertyBodies.get(propertyId);
  deliveredPropertyBodies.set(
    propertyId,
    prior ? `${prior}\n${trimmed}` : trimmed
  );
}

function shouldSkipPropertyListingMessage(
  property: Property,
  deliveredPropertyText: Set<string>,
  deliveredPropertyBodies: Map<string, string>
): boolean {
  if (deliveredPropertyText.has(property.id)) {
    return true;
  }

  const listingUrl = property.listing_url?.trim();
  if (!listingUrl) {
    return false;
  }

  const prior = deliveredPropertyBodies.get(property.id);
  return prior != null && prior.includes(listingUrl);
}

export function buildPropertyOutboundMessages(
  property: Property,
  detailsText: string,
  language: SupportedLanguage = "pt"
): OutboundWhatsAppMessage[] {
  const packageText = detailsText.trim();
  const messages: OutboundWhatsAppMessage[] = [];

  if (hasPropertyImage(property) && isValidOutboundUrl(property.image_url?.trim() ?? "")) {
    messages.push({
      kind: "property_image",
      property,
      fallbackText: packageText,
      language,
    });
    messages.push({
      kind: "property_details",
      text: packageText,
      property,
    });
    return sanitizePropertyOutboundMessages(messages);
  }

  messages.push({
    kind: "property_details",
    text: packageText,
    property,
  });

  return sanitizePropertyOutboundMessages(messages);
}

export function buildCatalogOutboundMessages(
  properties: Property[],
  detailsTexts: string[],
  language: SupportedLanguage = "pt"
): OutboundWhatsAppMessage[] {
  const messages: OutboundWhatsAppMessage[] = [];

  properties.forEach((property, index) => {
    const detailsText = detailsTexts[index] ?? "";

    messages.push(...buildPropertyOutboundMessages(property, detailsText, language));

    if (index < properties.length - 1) {
      messages.push({ kind: "catalog_spacer" });
    }
  });

  return sanitizePropertyOutboundMessages(messages);
}

export function buildPropertyDetailsWithListing(
  detailsText: string,
  listingUrl: string,
  language: SupportedLanguage = "pt"
): string {
  const trimmedDetails = detailsText.trim();
  const url = listingUrl.trim();

  if (!url || !isValidOutboundUrl(url) || trimmedDetails.includes(url)) {
    return trimmedDetails;
  }

  const listingLine = formatPropertyListingLine(language, url);
  if (trimmedDetails.includes(listingLine)) {
    return trimmedDetails;
  }

  return `${trimmedDetails}\n${listingLine}`;
}

export function buildPlainPropertySummary(
  property: Property,
  language: SupportedLanguage = "pt"
): string {
  const lang = normalizeLanguage(language);
  const location = property.neighborhood
    ? `${property.neighborhood}, ${property.city}`
    : property.city;
  const listing = property.listing_url?.trim();

  const lines = [
    formatPropertyDisplayTitle(property, lang),
    location ? `📍 ${location}` : null,
  ];

  if (listing && isValidOutboundUrl(listing)) {
    lines.push(formatPropertyListingLine(lang, listing));
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
