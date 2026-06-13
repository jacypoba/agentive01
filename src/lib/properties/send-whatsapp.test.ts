import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPropertyWhatsAppPackageText,
} from "@/lib/properties/property-cards";
import {
  buildPlainPropertySummary,
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

  it("plain property summary uses French listing label when language is fr", () => {
    const property = sampleProperty({
      id: "p-fr-plain",
      image_url: null,
      listing_url: listingUrl,
    });

    const summary = buildPlainPropertySummary(property, "fr");

    assert.match(summary, /🔗 Voir les détails:/);
    assert.doesNotMatch(summary, /View details/i);
  });

  it("property_listing fallback uses French when language is fr", async () => {
    let lastText = "";

    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => ({
        success: true,
        sentToWhatsApp: true,
        provider: "evolution",
      }),
      sendText: async (_phone, text) => {
        lastText = text;
        return { success: true, sentToWhatsApp: true, provider: "evolution" };
      },
    };

    const property = sampleProperty({ id: "p-fr-listing" });

    await sendOutboundWhatsAppMessages(
      "33612345678",
      [
        {
          kind: "property_listing",
          property,
          url: listingUrl,
          language: "fr",
        },
      ],
      undefined,
      undefined,
      deps
    );

    assert.match(lastText, /🔗 Voir les détails:/);
    assert.doesNotMatch(lastText, /View details/i);
  });

  it("image fallback uses French plain summary when package text is empty", async () => {
    let lastText = "";

    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => ({
        success: false,
        sentToWhatsApp: false,
        provider: "evolution",
        error: "media failed",
      }),
      sendText: async (_phone, text) => {
        lastText = text;
        return { success: true, sentToWhatsApp: true, provider: "evolution" };
      },
    };

    const property = sampleProperty({
      id: "p-fr-image-fallback",
      image_url: imageUrl,
      listing_url: listingUrl,
    });

    await sendOutboundWhatsAppMessages(
      "33612345678",
      buildPropertyOutboundMessages(property, "", "fr"),
      undefined,
      undefined,
      deps
    );

    assert.match(lastText, /🔗 Voir les détails:/);
    assert.doesNotMatch(lastText, /View details/i);
    assert.doesNotMatch(lastText, /💰/);
  });
});

describe("deliverPropertyImage plainSummary guard", () => {
  const failedTextResult: WhatsAppSendResult = {
    success: false,
    sentToWhatsApp: false,
    provider: "evolution",
    error: "provider ack false",
  };

  it("with full textCard and deliverText returns false → only one text attempt", async () => {
    let textCalls = 0;
    const texts: string[] = [];

    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => ({
        success: false,
        sentToWhatsApp: false,
        provider: "evolution",
        error: "media failed",
      }),
      sendText: async (_phone, text) => {
        textCalls += 1;
        texts.push(text);
        return failedTextResult;
      },
    };

    const property = sampleProperty({
      id: "p-no-double-fallback",
      image_url: imageUrl,
      listing_url: listingUrl,
    });
    const details = formatPropertyWhatsAppPackageText(property, "fr");

    await sendOutboundWhatsAppMessages(
      "33612345678",
      buildPropertyOutboundMessages(property, details, "fr"),
      undefined,
      undefined,
      deps
    );

    assert.equal(textCalls, 1);
    assert.match(texts[0] ?? "", /💰/);
    assert.match(texts[0] ?? "", /chambres/i);
    assert.doesNotMatch(texts[0] ?? "", /^Maison avec jardin\n📍/m);
  });

  it("with no textCard → plainSummary is still sent once", async () => {
    let textCalls = 0;
    let lastText = "";

    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => ({
        success: false,
        sentToWhatsApp: false,
        provider: "evolution",
        error: "media failed",
      }),
      sendText: async (_phone, text) => {
        textCalls += 1;
        lastText = text;
        return { success: true, sentToWhatsApp: true, provider: "evolution" };
      },
    };

    const property = sampleProperty({
      id: "p-plain-only",
      image_url: imageUrl,
      listing_url: listingUrl,
    });

    await sendOutboundWhatsAppMessages(
      "33612345678",
      buildPropertyOutboundMessages(property, "", "fr"),
      undefined,
      undefined,
      deps
    );

    assert.equal(textCalls, 1);
    assert.match(lastText, /🔗 Voir les détails:/);
    assert.doesNotMatch(lastText, /💰/);
  });

  it("French image_url + listing_url → image success and one details card only", async () => {
    let mediaCalls = 0;
    let textCalls = 0;
    const texts: string[] = [];

    const deps: OutboundWhatsAppSendDeps = {
      sendMedia: async () => {
        mediaCalls += 1;
        return { success: true, sentToWhatsApp: true, provider: "evolution" };
      },
      sendText: async (_phone, text) => {
        textCalls += 1;
        texts.push(text);
        return { success: true, sentToWhatsApp: true, provider: "evolution" };
      },
    };

    const property = sampleProperty({
      id: "p-fr-single-card",
      image_url: imageUrl,
      listing_url: listingUrl,
    });
    const details = formatPropertyWhatsAppPackageText(property, "fr");

    await sendOutboundWhatsAppMessages(
      "33612345678",
      buildPropertyOutboundMessages(property, details, "fr"),
      undefined,
      undefined,
      deps
    );

    assert.equal(mediaCalls, 1);
    assert.equal(textCalls, 1);
    assert.match(texts[0] ?? "", /💰/);
    assert.match(texts[0] ?? "", /chambres/i);
    assert.match(texts[0] ?? "", /🔗 Voir les détails:/);
  });
});
