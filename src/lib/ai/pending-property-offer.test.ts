import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyMessageIntent,
  shouldQueryProperties,
  shouldRunFreshPropertyQuery,
} from "@/lib/ai/intent-classifier";
import {
  buildPendingOfferFromCityAlternative,
  deriveSearchCriteriaFromPendingOffer,
  getActivePendingPropertyOffer,
  parsePendingPropertyOffer,
} from "@/lib/ai/pending-property-offer";
import { buildCityAlternativeSummary } from "@/lib/properties/city-alternatives";
import { searchMatchingProperties } from "@/lib/data/properties";
import type { Conversation, Lead, PendingPropertyOffer, Property } from "@/types/database";

function property(partial: Partial<Property> & Pick<Property, "city">): Property {
  return {
    id: partial.id ?? "prop-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    title: partial.title ?? "Listing",
    city: partial.city,
    neighborhood: partial.neighborhood ?? null,
    property_type: partial.property_type ?? "moradia",
    price: partial.price ?? 500_000,
    bedrooms: partial.bedrooms ?? 3,
    bathrooms: partial.bathrooms ?? 2,
    description: partial.description ?? null,
    image_url: partial.image_url ?? null,
    listing_url: partial.listing_url ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

const milanoNavigli = property({
  id: "milano-navigli",
  city: "Milano",
  neighborhood: "Navigli",
  property_type: "moradia",
  price: 650_000,
});

const milanoCentro = property({
  id: "milano-centro",
  city: "Milano",
  neighborhood: "Centro",
  property_type: "moradia",
  price: 420_000,
});

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    client_name: "Test",
    phone: null,
    phone_normalized: null,
    interest: null,
    status: "new",
    budget: null,
    preferred_area: "Roma",
    property_type: "moradia",
    timeline: null,
    intent_status: "unknown",
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: "pt",
    pending_property_offer: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function pendingMilanoOffer(): PendingPropertyOffer {
  return {
    offeredCity: "Milano",
    offeredAreas: ["Navigli"],
    source: "city_fallback",
    createdAt: new Date().toISOString(),
    status: "pending",
    requestedCity: "Roma",
    propertyType: "moradia",
    maxBudget: null,
  };
}

function clientMessage(text: string): Conversation {
  return {
    id: `msg-${text.slice(0, 8)}`,
    lead_id: "lead-1",
    workspace_id: "ws-1",
    message: text,
    sender: "client",
    created_at: new Date().toISOString(),
  };
}

function mockSupabase(properties: Property[]) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                order() {
                  return Promise.resolve({ data: properties, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("classifyMessageIntent with pending offer", () => {
  const lead = baseLead({ pending_property_offer: pendingMilanoOffer() });

  it('classifies "Sim, por favor" as accept_pending_offer when offer is pending', () => {
    const result = classifyMessageIntent([clientMessage("Sim, por favor")], lead);
    assert.equal(result.intent, "accept_pending_offer");
  });

  it('classifies "sim" as accept_pending_offer when offer is pending', () => {
    const result = classifyMessageIntent([clientMessage("sim")], lead);
    assert.equal(result.intent, "accept_pending_offer");
    assert.equal(shouldQueryProperties(result), true);
    assert.equal(shouldRunFreshPropertyQuery(result), false);
  });

  it('classifies "mostra-me" as accept_pending_offer when offer is pending', () => {
    const result = classifyMessageIntent([clientMessage("mostra-me")], lead);
    assert.equal(result.intent, "accept_pending_offer");
  });

  it('classifies "yes" and "oui" as accept_pending_offer', () => {
    assert.equal(
      classifyMessageIntent([clientMessage("yes")], lead).intent,
      "accept_pending_offer"
    );
    assert.equal(
      classifyMessageIntent([clientMessage("oui")], lead).intent,
      "accept_pending_offer"
    );
  });

  it('classifies "mostrami" as ask_more_options without pending offer', () => {
    const result = classifyMessageIntent([clientMessage("mostrami")], baseLead());
    assert.equal(result.intent, "ask_more_options");
  });

  it("budget-only follow-up stays unknown and keeps pending offer on lead", () => {
    const leadWithBudgetFollowUp = baseLead({
      pending_property_offer: pendingMilanoOffer(),
    });
    const result = classifyMessageIntent(
      [clientMessage("800 mil")],
      leadWithBudgetFollowUp
    );
    assert.equal(result.intent, "unknown");
    assert.equal(shouldQueryProperties(result), false);
    assert.ok(getActivePendingPropertyOffer(leadWithBudgetFollowUp));
  });
});

describe("pending offer persistence helpers", () => {
  it("builds pending offer from Roma fallback to Milano/Navigli", () => {
    const summary = buildCityAlternativeSummary(
      [milanoNavigli],
      { city: "Roma", propertyType: "moradia" }
    );
    assert.ok(summary);

    const offer = buildPendingOfferFromCityAlternative(summary, {
      city: "Roma",
      propertyType: "moradia",
    });

    assert.equal(offer.offeredCity, "Milano");
    assert.deepEqual(offer.offeredAreas, ["Navigli"]);
    assert.equal(offer.status, "pending");
    assert.equal(offer.source, "city_fallback");
    assert.equal(offer.requestedCity, "Roma");
  });

  it("marks completed offers as inactive", () => {
    const lead = baseLead({
      pending_property_offer: {
        ...pendingMilanoOffer(),
        status: "completed",
      },
    });
    assert.equal(getActivePendingPropertyOffer(lead), null);
    assert.ok(parsePendingPropertyOffer(lead));
  });
});

describe("accept pending offer search", () => {
  it("Roma fallback -> sim uses Milano/Navigli criteria, not lead.preferred_area", async () => {
    const offer = pendingMilanoOffer();
    const lead = baseLead({ pending_property_offer: offer, preferred_area: "Roma" });
    const criteria = deriveSearchCriteriaFromPendingOffer(offer, lead);

    assert.ok(criteria);
    assert.equal(criteria.city, "Milano");
    assert.equal(criteria.propertyType, "moradia");
    assert.equal(criteria.neighborhood, "Navigli");

    const supabase = mockSupabase([milanoNavigli, milanoCentro]) as never;
    const matches = await searchMatchingProperties(supabase, "ws-1", criteria, 20);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, "milano-navigli");
  });

  it("Firenze fallback -> mostra-me finds Milano/Navigli listings", async () => {
    const summary = buildCityAlternativeSummary(
      [milanoNavigli],
      { city: "Firenze", propertyType: "moradia" }
    );
    assert.ok(summary);

    const offer = buildPendingOfferFromCityAlternative(summary, {
      city: "Firenze",
      propertyType: "moradia",
    });
    const lead = baseLead({
      preferred_area: "Firenze",
      pending_property_offer: offer,
    });

    const criteria = deriveSearchCriteriaFromPendingOffer(offer, lead);
    assert.ok(criteria);

    const supabase = mockSupabase([milanoNavigli]) as never;
    const matches = await searchMatchingProperties(supabase, "ws-1", criteria!, 20);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.neighborhood, "Navigli");
  });
});

describe("offer lifecycle", () => {
  it("completed offer is not active for acceptance routing", () => {
    const lead = baseLead({
      pending_property_offer: {
        ...pendingMilanoOffer(),
        status: "completed",
      },
    });

    const result = classifyMessageIntent([clientMessage("sim")], lead);
    assert.notEqual(result.intent, "accept_pending_offer");
  });
});
