import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeAiReply } from "@/lib/ai/dedupe-reply";
import { sanitizeGuardedReply } from "@/lib/ai/guardrails";
import { formatPropertyWhatsAppPackageText } from "@/lib/properties/property-cards";
import {
  buildRecommendationIntroText,
  preparePropertyRecommendationIntroOutbound,
} from "@/lib/properties/recommendation-intros";
import {
  buildPropertyOutboundMessages,
  type OutboundWhatsAppMessage,
} from "@/lib/properties/send-whatsapp";
import type { SupportedLanguage } from "@/lib/i18n/types";
import type { Conversation, Property } from "@/types/database";

const LEAD_ID = "lead-intro-test";
const languages: SupportedLanguage[] = ["pt", "it", "en", "es", "fr"];

function clientMessage(text: string): Conversation {
  return {
    id: `client-${text.slice(0, 8)}`,
    lead_id: LEAD_ID,
    message: text,
    sender: "client",
    created_at: new Date().toISOString(),
  };
}

function aiMessage(text: string): Conversation {
  return {
    id: `ai-${text.slice(0, 8)}`,
    lead_id: LEAD_ID,
    message: text,
    sender: "ai",
    created_at: new Date().toISOString(),
  };
}

function propertyPayload(id: string): Conversation {
  return aiMessage(`🏡 Sample\n[property:${id}]`);
}

function sampleProperty(id: string): Property {
  return {
    id,
    user_id: "user-1",
    workspace_id: "ws-1",
    title: "Moradia com jardim",
    city: "Milano",
    neighborhood: "Navigli",
    property_type: "moradia",
    price: 750_000,
    bedrooms: 2,
    bathrooms: 2,
    description: null,
    image_url: "https://cdn.example/sample.jpg",
    listing_url: "https://agency.example/listings/sample-1",
    created_at: new Date().toISOString(),
  };
}

function propertySearchGuard(language: SupportedLanguage) {
  return {
    intent: "property_search" as const,
    freshQueryMade: true,
    propertiesSent: true,
    language,
  };
}

function assembleSinglePropertyBatch(
  language: SupportedLanguage,
  history: Conversation[],
  outboundMessages: OutboundWhatsAppMessage[] = []
): OutboundWhatsAppMessage[] {
  const seenThisTurn = new Set<string>();
  const introText = buildRecommendationIntroText(
    language,
    history,
    LEAD_ID,
    1,
    {
      intent: "property_search",
      wantsReshow: false,
      wantsMore: false,
      latestMessage: history.at(-1)?.message ?? "",
    },
    true
  );

  const preparedIntro = preparePropertyRecommendationIntroOutbound(
    introText,
    seenThisTurn,
    outboundMessages,
    propertySearchGuard(language)
  );

  const batch: OutboundWhatsAppMessage[] = [...outboundMessages];
  if (preparedIntro) {
    batch.push({ kind: "text", text: preparedIntro });
  }

  const property = sampleProperty(`p-${language}`);
  const details = formatPropertyWhatsAppPackageText(property, language);
  batch.push(...buildPropertyOutboundMessages(property, details, language));

  return batch;
}

describe("property recommendation intro outbound", () => {
  it("FR pivot batch sends intro even when a similar intro was sent before", () => {
    const frIntro = "Voici une option qui pourrait vous intéresser 👇";
    const history = [
      clientMessage("Je cherche à Florence"),
      aiMessage(frIntro),
      propertyPayload("firenze-1"),
      clientMessage("Et à Milan ?"),
    ];

    const guard = propertySearchGuard("fr");
    assert.equal(dedupeAiReply(frIntro, history).trim(), "");
    assert.equal(sanitizeGuardedReply(frIntro, history, guard), null);

    const prepared = preparePropertyRecommendationIntroOutbound(
      frIntro,
      new Set<string>(),
      [],
      guard
    );

    assert.ok(prepared);
    assert.match(prepared!, /intéresser|option|correspond/i);
  });

  for (const language of languages) {
    it(`${language}: one localized intro is queued before image and details card`, () => {
      const history = [clientMessage("search message")];
      const batch = assembleSinglePropertyBatch(language, history);

      const textMessages = batch.filter((message) => message.kind === "text");
      assert.equal(textMessages.length, 1, "expected exactly one intro text");

      const introIndex = batch.findIndex((message) => message.kind === "text");
      const imageIndex = batch.findIndex((message) => message.kind === "property_image");
      const detailsIndex = batch.findIndex(
        (message) => message.kind === "property_details"
      );

      assert.ok(introIndex >= 0);
      assert.ok(introIndex < imageIndex, "intro must precede image");
      assert.ok(introIndex < detailsIndex, "intro must precede details card");
      assert.equal(
        batch.filter((message) => message.kind === "property_details").length,
        1
      );
      assert.equal(
        batch.some((message) => message.kind === "property_listing"),
        false
      );
    });
  }

  it("does not duplicate intro within the same recommendation batch", () => {
    const history = [
      clientMessage("Je cherche à Florence"),
      aiMessage("Voici une option qui pourrait vous intéresser 👇"),
      propertyPayload("firenze-1"),
      clientMessage("Et à Milan ?"),
    ];
    const guard = propertySearchGuard("fr");
    const seenThisTurn = new Set<string>();
    const outboundMessages: OutboundWhatsAppMessage[] = [];
    const introText = buildRecommendationIntroText(
      "fr",
      history,
      LEAD_ID,
      1,
      {
        intent: "property_search",
        wantsReshow: false,
        wantsMore: false,
        latestMessage: "Et à Milan ?",
      },
      true
    );

    const first = preparePropertyRecommendationIntroOutbound(
      introText,
      seenThisTurn,
      outboundMessages,
      guard
    );
    assert.ok(first);
    outboundMessages.push({ kind: "text", text: first! });

    const second = preparePropertyRecommendationIntroOutbound(
      introText,
      seenThisTurn,
      outboundMessages,
      guard
    );
    assert.equal(second, null);
    assert.equal(
      outboundMessages.filter((message) => message.kind === "text").length,
      1
    );
  });
});
