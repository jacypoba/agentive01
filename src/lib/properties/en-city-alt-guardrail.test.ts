import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executePropertyDecision } from "@/lib/ai/conversation-decision/execute-property-decision";
import { sanitizeGuardedReply } from "@/lib/ai/guardrails";
import { getConsultantLanguageFallback } from "@/lib/i18n/reply-language";
import {
  buildCityAlternativeFallbackText,
  buildCityAlternativeSummary,
} from "@/lib/properties/city-alternatives";
import type { Property } from "@/types/database";

const LEAD_ID = "lead-en-roma-guard";

function property(partial: Partial<Property> & Pick<Property, "city">): Property {
  return {
    id: partial.id ?? "prop-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    title: partial.title ?? "Listing",
    city: partial.city,
    neighborhood: partial.neighborhood ?? null,
    property_type: partial.property_type ?? "moradia",
    price: partial.price ?? 650_000,
    bedrooms: partial.bedrooms ?? 3,
    bathrooms: partial.bathrooms ?? 2,
    description: null,
    image_url: null,
    listing_url: null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

const romaCriteriaSummary = buildCityAlternativeSummary(
  [property({ id: "firenze-1", city: "Firenze", neighborhood: "Novoli" })],
  { city: "Roma", propertyType: "moradia" }
);

const propertySearchGuard = {
  intent: "property_search" as const,
  freshQueryMade: true,
  propertiesSent: false,
  language: "en" as const,
};

describe("EN city-alternative guardrail safety", () => {
  it("passes sanitizeGuardedReply without consultant fallback substitution", () => {
    assert.ok(romaCriteriaSummary);
    const text = buildCityAlternativeFallbackText("en", romaCriteriaSummary);
    const history = [
      {
        id: "1",
        lead_id: LEAD_ID,
        workspace_id: "ws-1",
        message: "hi, i'm looking for a house to buy in Roma",
        sender: "client" as const,
        created_at: "",
      },
    ];

    const sanitized = sanitizeGuardedReply(text, history, propertySearchGuard);
    const consultant = getConsultantLanguageFallback("en");

    assert.ok(sanitized);
    assert.notEqual(sanitized, consultant);
    assert.match(sanitized, /Roma/i);
    assert.match(sanitized, /Firenze/i);
    assert.equal(/^Sure[,.\s]/i.test(sanitized!), false);
  });

  it("Property V1 show_city_alternatives qualifying reply is not replaced by guardrails", () => {
    assert.ok(romaCriteriaSummary);
    const execution = executePropertyDecision({
      built: {
        decision: {
          action: "show_city_alternatives",
          language: "en",
          criteria: {
            city: "Roma",
            neighborhood: null,
            budget: null,
            propertyType: "moradia",
            buyRentIntent: "buy",
          },
          contextUse: {
            usedPendingOffer: false,
            userOverrodePendingOffer: false,
            usedLeadMemory: false,
          },
          missingCriteria: [],
          reason: "zero_match_with_alternative_cities",
          confidence: "high",
          replyInstruction: {
            kind: "deterministic",
            template: "city_alternative_offer",
          },
        },
        resolved: {
          criteria: {
            city: "Roma",
            propertyType: "moradia",
            buyRentIntent: "buy",
          },
          contextUse: {
            usedPendingOffer: false,
            userOverrodePendingOffer: false,
            usedLeadMemory: false,
          },
          pendingOfferAccepted: false,
          pendingOfferRejected: false,
          explicitCityInLatest: "Roma",
        },
        matchingProperties: [],
        cityAlternatives: romaCriteriaSummary,
        searchCriteria: { city: "Roma", propertyType: "moradia" },
      },
      history: [],
      leadId: LEAD_ID,
      language: "en",
    });

    assert.ok(execution.qualifyingReply);
    const sanitized = sanitizeGuardedReply(
      execution.qualifyingReply!,
      [],
      propertySearchGuard
    );
    assert.ok(sanitized);
    assert.notEqual(sanitized, getConsultantLanguageFallback("en"));
    assert.match(sanitized, /don't have anything in Roma|have options in Firenze/i);
  });

  it("LLM-style Sure opener remains blocked for English", () => {
    const llmStyle =
      "Sure, I'll look at options in that range. Any preferred area?";
    const blocked = sanitizeGuardedReply(
      llmStyle,
      [],
      propertySearchGuard
    );
    assert.notEqual(blocked, llmStyle);
    assert.ok(blocked === null || blocked === getConsultantLanguageFallback("en"));
  });
});
