import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPropertyWhatsAppPackageText } from "@/lib/properties/property-cards";
import {
  buildCatalogOutboundMessages,
  buildPropertyOutboundMessages,
  sanitizePropertyOutboundMessages,
  sendOutboundWhatsAppMessages,
  type OutboundWhatsAppMessage,
  type OutboundWhatsAppSendDeps,
} from "@/lib/properties/send-whatsapp";
import type { SupportedLanguage } from "@/lib/i18n/types";
import type { Property } from "@/types/database";
import type { WhatsAppSendResult } from "@/lib/whatsapp/types";

const listingUrl = "https://agency.example/listings/sample-1";
const imageUrl = "https://cdn.example/sample.jpg";

function sampleProperty(
  partial: Partial<Property> & Pick<Property, "id">
): Property {
  return {
    id: partial.id,
    user_id: "user-1",
    workspace_id: "ws-1",
    title: partial.title ?? "Moradia com jardim",
    city: partial.city ?? "Milano",
    neighborhood: partial.neighborhood ?? "Navigli",
    property_type: partial.property_type ?? "moradia",
    price: partial.price ?? 750_000,
    bedrooms: partial.bedrooms ?? 2,
    bathrooms: partial.bathrooms ?? 2,
    description: partial.description ?? null,
    image_url: partial.image_url ?? null,
    listing_url: partial.listing_url ?? listingUrl,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

function successResult(): WhatsAppSendResult {
  return { success: true, sentToWhatsApp: true, provider: "evolution" };
}

function assertNoPropertyListing(messages: OutboundWhatsAppMessage[]) {
  assert.equal(
    messages.some((message) => message.kind === "property_listing"),
    false,
    "property_listing must not be queued when details already include the URL"
  );
}

function assertPackageHasListingUrl(text: string) {
  assert.match(text, new RegExp(listingUrl.replace(/\./g, "\\.")));
}

const languages: SupportedLanguage[] = ["pt", "it", "en", "es", "fr"];

describe("property outbound package — no duplicate listing messages", () => {
  for (const language of languages) {
    it(`${language}: buildPropertyOutboundMessages has no property_listing`, () => {
      const property = sampleProperty({
        id: `p-${language}`,
        image_url: imageUrl,
        listing_url: listingUrl,
      });
      const details = formatPropertyWhatsAppPackageText(property, language);
      assertPackageHasListingUrl(details);

      const messages = buildPropertyOutboundMessages(property, details, language);
      assertNoPropertyListing(messages);
      assert.equal(
        messages.filter((message) => message.kind === "property_details").length,
        1
      );
    });

    it(`${language}: sendOutbound delivers one text card with listing URL`, async () => {
      const texts: string[] = [];
      const deps: OutboundWhatsAppSendDeps = {
        sendMedia: async () => successResult(),
        sendText: async (_phone, text) => {
          texts.push(text);
          return successResult();
        },
      };

      const property = sampleProperty({
        id: `p-send-${language}`,
        image_url: imageUrl,
        listing_url: listingUrl,
      });
      const details = formatPropertyWhatsAppPackageText(property, language);

      await sendOutboundWhatsAppMessages(
        "393471234567",
        buildPropertyOutboundMessages(property, details, language),
        undefined,
        undefined,
        deps
      );

      assert.equal(texts.length, 1);
      assertPackageHasListingUrl(texts[0] ?? "");
    });
  }

  it("sanitizePropertyOutboundMessages drops listing when details include URL", () => {
    const property = sampleProperty({ id: "p-sanitize" });
    const details = formatPropertyWhatsAppPackageText(property, "fr");

    const sanitized = sanitizePropertyOutboundMessages([
      { kind: "property_details", text: details, property },
      { kind: "property_listing", property, url: listingUrl, language: "fr" },
    ]);

    assertNoPropertyListing(sanitized);
  });

  it("legacy queue with property_listing sends only one text when details include URL", async () => {
    const texts: string[] = [];
    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => ({
        success: false,
        sentToWhatsApp: false,
        provider: "evolution",
        error: "skip media",
      }),
      sendText: async (_phone, text) => {
        texts.push(text);
        return successResult();
      },
    };

    const property = sampleProperty({
      id: "p-legacy",
      image_url: null,
      listing_url: listingUrl,
    });
    const details = formatPropertyWhatsAppPackageText(property, "fr");

    await sendOutboundWhatsAppMessages(
      "33612345678",
      [
        { kind: "property_details", text: details, property },
        { kind: "property_listing", property, url: listingUrl, language: "fr" },
      ],
      undefined,
      undefined,
      deps
    );

    assert.equal(texts.length, 1);
    assertPackageHasListingUrl(texts[0] ?? "");
    assert.match(texts[0] ?? "", /chambres|bedrooms|camere|habitaciones/i);
  });

  it("catalog batch: each property once, no property_listing duplicates", () => {
    const properties = [
      sampleProperty({ id: "cat-1", title: "Moradia com jardim" }),
      sampleProperty({ id: "cat-2", title: "Apartamento Navigli" }),
      sampleProperty({ id: "cat-3", title: "Casa Teste" }),
    ];
    const detailsTexts = properties.map((property) =>
      formatPropertyWhatsAppPackageText(property, "it")
    );

    const messages = buildCatalogOutboundMessages(properties, detailsTexts, "it");

    assertNoPropertyListing(messages);
    assert.equal(
      messages.filter((message) => message.kind === "property_details").length,
      properties.length
    );
    assert.equal(
      messages.filter((message) => message.kind === "property_image").length,
      0
    );
    assert.equal(
      messages.filter((message) => message.kind === "catalog_spacer").length,
      properties.length - 1
    );

    const ids = new Set(
      messages
        .filter(
          (message) =>
            message.kind === "property_details" || message.kind === "property_image"
        )
        .map((message) => message.property.id)
    );
    assert.equal(ids.size, properties.length);
  });

  it("catalog send delivers one text per property with listing URL", async () => {
    const texts: string[] = [];
    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => successResult(),
      sendText: async (_phone, text) => {
        texts.push(text);
        return successResult();
      },
    };

    const properties = [
      sampleProperty({ id: "live-1", image_url: imageUrl }),
      sampleProperty({ id: "live-2", image_url: imageUrl }),
    ];
    const detailsTexts = properties.map((property) =>
      formatPropertyWhatsAppPackageText(property, "fr")
    );

    await sendOutboundWhatsAppMessages(
      "33612345678",
      buildCatalogOutboundMessages(properties, detailsTexts, "fr"),
      undefined,
      undefined,
      deps
    );

    const propertyTexts = texts.filter((text) => text.includes(listingUrl));
    assert.equal(propertyTexts.length, properties.length);
    for (const text of propertyTexts) {
      assertPackageHasListingUrl(text);
    }
  });
});
