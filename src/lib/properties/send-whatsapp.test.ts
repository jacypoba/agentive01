import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPropertyWhatsAppPackageText,
} from "@/lib/properties/property-cards";
import {
  buildPropertyOutboundMessages,
  sendOutboundWhatsAppMessages,
  type OutboundWhatsAppSendDeps,
} from "@/lib/properties/send-whatsapp";
import type { Property } from "@/types/database";
import type { WhatsAppSendResult } from "@/lib/whatsapp/types";

function sampleProperty(
  partial: Partial<Property> & Pick<Property, "id">
): Property {
  return {
    id: partial.id,
    user_id: "user-1",
    workspace_id: "ws-1",
    title: partial.title ?? "Appartamento Navigli",
    city: partial.city ?? "Milano",
    neighborhood: partial.neighborhood ?? "Navigli",
    property_type: partial.property_type ?? "apartamento",
    price: partial.price ?? 800_000,
    bedrooms: partial.bedrooms ?? 2,
    bathrooms: partial.bathrooms ?? 1,
    description: partial.description ?? null,
    image_url: partial.image_url ?? null,
    listing_url: partial.listing_url ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

const listingUrl = "https://agency.example/listings/navigli-1";
const imageUrl = "https://cdn.example/navigli.jpg";

describe("formatPropertyWhatsAppPackageText", () => {
  it("includes contextual listing line for Italian", () => {
    const property = sampleProperty({
      id: "p-it",
      listing_url: listingUrl,
    });

    const text = formatPropertyWhatsAppPackageText(property, "it");
    assert.match(text, /🏡 Appartamento Navigli/);
    assert.match(text, /🔗 Vedi dettagli: https:\/\/agency\.example/);
    assert.doesNotMatch(text, /^https:\/\//m);
  });
});

describe("buildPropertyOutboundMessages", () => {
  it("image_url + listing_url → image + details messages", () => {
    const property = sampleProperty({
      id: "p-both",
      image_url: imageUrl,
      listing_url: listingUrl,
    });
    const details = formatPropertyWhatsAppPackageText(property, "it");
    const messages = buildPropertyOutboundMessages(property, details);

    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.kind, "property_image");
    assert.equal(messages[1]?.kind, "property_details");
    assert.match(messages[1]?.kind === "property_details" ? messages[1].text : "", /Vedi dettagli:/);
    assert.equal(
      messages.some((message) => message.kind === "property_listing"),
      false
    );
  });

  it("image_url only → image + details text", () => {
    const property = sampleProperty({
      id: "p-image",
      image_url: imageUrl,
      listing_url: null,
    });
    const details = formatPropertyWhatsAppPackageText(property, "en");
    const messages = buildPropertyOutboundMessages(property, details);

    assert.deepEqual(
      messages.map((message) => message.kind),
      ["property_image", "property_details"]
    );
    assert.doesNotMatch(details, /https:\/\//);
  });

  it("listing_url only → details text with contextual link", () => {
    const property = sampleProperty({
      id: "p-link",
      image_url: null,
      listing_url: listingUrl,
    });
    const details = formatPropertyWhatsAppPackageText(property, "it");
    const messages = buildPropertyOutboundMessages(property, details);

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.kind, "property_details");
    assert.match(details, /🔗 Vedi dettagli: https:\/\/agency\.example/);
  });

  it("no image/no link → details text only", () => {
    const property = sampleProperty({
      id: "p-plain",
      image_url: null,
      listing_url: null,
    });
    const details = formatPropertyWhatsAppPackageText(property, "en");
    const messages = buildPropertyOutboundMessages(property, details);

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.kind, "property_details");
    assert.doesNotMatch(details, /https:\/\//);
  });
});

describe("sendOutboundWhatsAppMessages property package delivery", () => {
  function successResult(): WhatsAppSendResult {
    return { success: true, sentToWhatsApp: true, provider: "evolution" };
  }

  it("sends image then details when media succeeds", async () => {
    let mediaCalls = 0;
    let textCalls = 0;
    let lastText = "";

    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => {
        mediaCalls += 1;
        return successResult();
      },
      sendText: async (_phone, text) => {
        textCalls += 1;
        lastText = text;
        return successResult();
      },
    };

    const property = sampleProperty({
      id: "p-live",
      image_url: imageUrl,
      listing_url: listingUrl,
    });
    const details = formatPropertyWhatsAppPackageText(property, "it");

    const report = await sendOutboundWhatsAppMessages(
      "393471234567",
      buildPropertyOutboundMessages(property, details),
      undefined,
      undefined,
      deps
    );

    assert.equal(mediaCalls, 1);
    assert.equal(textCalls, 1);
    assert.match(lastText, /Vedi dettagli:/);
    assert.equal(report.sent, 2);
    assert.equal(report.failed, 0);
  });

  it("falls back to details text when image send fails", async () => {
    let mediaCalls = 0;
    let textCalls = 0;
    let lastText = "";

    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => {
        mediaCalls += 1;
        return {
          success: false,
          sentToWhatsApp: false,
          provider: "evolution",
          error: "media failed",
        };
      },
      sendText: async (_phone, text) => {
        textCalls += 1;
        lastText = text;
        return successResult();
      },
    };

    const property = sampleProperty({
      id: "p-fallback",
      image_url: imageUrl,
      listing_url: listingUrl,
    });
    const details = formatPropertyWhatsAppPackageText(property, "it");

    const report = await sendOutboundWhatsAppMessages(
      "393471234567",
      buildPropertyOutboundMessages(property, details),
      undefined,
      undefined,
      deps
    );

    assert.equal(mediaCalls, 1);
    assert.equal(textCalls, 1);
    assert.match(lastText, /Vedi dettagli:/);
    assert.equal(report.sent, 1);
    assert.equal(report.failed, 1);
  });
});
