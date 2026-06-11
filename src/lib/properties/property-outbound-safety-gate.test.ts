import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPropertyOutboundSafetyGate,
  filterPropertiesForOutboundSafetyGate,
} from "@/lib/properties/property-outbound-safety-gate";
import { buildCatalogOutboundMessages } from "@/lib/properties/send-whatsapp";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { Lead, Property } from "@/types/database";

const EMPTY_AVAILABILITY: PropertyAvailability = {
  matchingTotal: 0,
  shownCount: 0,
  remainingCount: 0,
  toSend: [],
  remainingAfterSend: 0,
  allShown: false,
  noMatchesInDatabase: false,
  criteriaMissing: false,
};

function sampleProperty(
  partial: Partial<Property> & Pick<Property, "id">
): Property {
  return {
    id: partial.id,
    user_id: "user-1",
    workspace_id: "ws-1",
    title: partial.title ?? "Listing",
    city: partial.city ?? "Milano",
    neighborhood: partial.neighborhood ?? "Navigli",
    property_type: partial.property_type ?? "moradia",
    price: partial.price ?? 750_000,
    bedrooms: partial.bedrooms ?? 3,
    bathrooms: partial.bathrooms ?? 2,
    description: null,
    image_url: null,
    listing_url: null,
    created_at: new Date().toISOString(),
  };
}

function baseLead(partial: Partial<Lead> = {}): Lead {
  return {
    id: "lead-gate-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    client_name: "Test",
    phone: null,
    phone_normalized: null,
    interest: null,
    status: "new",
    budget: "800000",
    preferred_area: "Milano",
    property_type: "moradia",
    timeline: null,
    intent_status: "unknown",
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: "pt",
    pending_property_offer: null,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe("Property Outbound Safety Gate V1", () => {
  const milanoCriteria = {
    city: "Milano",
    propertyType: "moradia",
    maxBudget: 800_000,
  };

  it("blocks Firenze when finalCriteria.city=Milano", () => {
    const result = filterPropertiesForOutboundSafetyGate({
      leadId: "lead-1",
      properties: [
        sampleProperty({ id: "firenze-1", city: "Firenze", neighborhood: "Novoli" }),
      ],
      finalCriteria: milanoCriteria,
    });

    assert.equal(result.allowed.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.equal(result.blocked[0]?.reason, "city_mismatch");
    assert.equal(result.allBlocked, true);
  });

  it("allows Milano when finalCriteria.city=Milano", () => {
    const result = filterPropertiesForOutboundSafetyGate({
      leadId: "lead-1",
      properties: [
        sampleProperty({ id: "milano-1", city: "Milano", neighborhood: "Navigli" }),
      ],
      finalCriteria: milanoCriteria,
    });

    assert.equal(result.allowed.length, 1);
    assert.equal(result.allowed[0]?.id, "milano-1");
    assert.equal(result.blocked.length, 0);
  });

  it("blocks Milano/Novoli when neighborhood=Navigli is required", () => {
    const result = filterPropertiesForOutboundSafetyGate({
      leadId: "lead-1",
      properties: [
        sampleProperty({ id: "novoli-1", city: "Milano", neighborhood: "Novoli" }),
      ],
      finalCriteria: {
        ...milanoCriteria,
        neighborhood: "Navigli",
      },
    });

    assert.equal(result.allowed.length, 0);
    assert.equal(result.blocked[0]?.reason, "neighborhood_mismatch");
  });

  it("blocks property above maxBudget", () => {
    const result = filterPropertiesForOutboundSafetyGate({
      leadId: "lead-1",
      properties: [
        sampleProperty({
          id: "expensive-1",
          city: "Milano",
          neighborhood: "Navigli",
          price: 900_000,
        }),
      ],
      finalCriteria: milanoCriteria,
    });

    assert.equal(result.allowed.length, 0);
    assert.equal(result.blocked[0]?.reason, "budget_exceeded");
  });

  it("clears all properties when every candidate is blocked", () => {
    const result = applyPropertyOutboundSafetyGate({
      leadId: "lead-1",
      properties: [
        sampleProperty({ id: "firenze-1", city: "Firenze", neighborhood: "Novoli" }),
      ],
      criteria: milanoCriteria,
      lead: baseLead(),
      history: [],
      availability: {
        ...EMPTY_AVAILABILITY,
        matchingTotal: 1,
        toSend: [sampleProperty({ id: "firenze-1", city: "Firenze" })],
      },
    });

    assert.equal(result.properties.length, 0);
    assert.equal(result.allBlocked, true);
    assert.equal(result.availability.noMatchesInDatabase, true);
    assert.equal(result.availability.toSend.length, 0);
  });

  it('regression: pivot "Firenze fica longe..., tens algo em Milano?" blocks Firenze cards', () => {
    const firenzeProperty = sampleProperty({
      id: "firenze-stale",
      city: "Firenze",
      neighborhood: "Novoli",
    });
    const milanoProperty = sampleProperty({
      id: "milano-ok",
      city: "Milano",
      neighborhood: "Navigli",
    });

    const result = filterPropertiesForOutboundSafetyGate({
      leadId: "lead-pivot",
      properties: [firenzeProperty, milanoProperty],
      finalCriteria: milanoCriteria,
    });

    assert.deepEqual(
      result.allowed.map((property) => property.id),
      ["milano-ok"]
    );
    assert.equal(result.blocked[0]?.property.id, "firenze-stale");
    assert.equal(result.blocked[0]?.reason, "city_mismatch");

    const outbound = buildCatalogOutboundMessages(result.allowed, ["details"]);
    assert.equal(
      outbound.some(
        (message) =>
          message.kind === "property_image" ||
          message.kind === "property_details" ||
          message.kind === "property_listing"
      ),
      result.allowed.length > 0
    );
    assert.equal(
      outbound.some(
        (message) =>
          (message.kind === "property_image" ||
            message.kind === "property_details" ||
            message.kind === "property_listing") &&
          message.property.city === "Firenze"
      ),
      false
    );
  });
});
