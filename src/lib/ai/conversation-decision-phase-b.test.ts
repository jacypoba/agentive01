import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  buildConversationDecisionShadow,
  decisionCriteriaToSearchCriteria,
  filterPropertiesForDecisionCity,
  isConversationDecisionEnginePhaseBEnabled,
  resolveCriteriaShadow,
  shouldApplyPhaseBCityOverride,
} from "@/lib/ai/conversation-decision";
import type { Conversation, Lead, PendingPropertyOffer, Property } from "@/types/database";

const ORIGINAL_PHASE_B = process.env.CONVERSATION_DECISION_ENGINE_PHASE_B;

function firenzeOffer(): PendingPropertyOffer {
  return {
    offeredCity: "Firenze",
    offeredAreas: ["Novoli"],
    source: "city_fallback",
    createdAt: new Date().toISOString(),
    status: "pending",
    requestedCity: "Roma",
    propertyType: "moradia",
    maxBudget: null,
  };
}

function milanoOffer(): PendingPropertyOffer {
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

function baseLead(partial: Partial<Lead> = {}): Lead {
  return {
    id: "lead-phase-b-1",
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
    pending_property_offer: firenzeOffer(),
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe("isConversationDecisionEnginePhaseBEnabled", () => {
  afterEach(() => {
    if (ORIGINAL_PHASE_B === undefined) {
      delete process.env.CONVERSATION_DECISION_ENGINE_PHASE_B;
    } else {
      process.env.CONVERSATION_DECISION_ENGINE_PHASE_B = ORIGINAL_PHASE_B;
    }
  });

  it("is false by default", () => {
    delete process.env.CONVERSATION_DECISION_ENGINE_PHASE_B;
    assert.equal(isConversationDecisionEnginePhaseBEnabled(), false);
  });

  it("is true when CONVERSATION_DECISION_ENGINE_PHASE_B=true", () => {
    process.env.CONVERSATION_DECISION_ENGINE_PHASE_B = "true";
    assert.equal(isConversationDecisionEnginePhaseBEnabled(), true);
  });
});

describe("shouldApplyPhaseBCityOverride", () => {
  it("requires userOverrodePendingOffer, show_properties, and city", () => {
    const decision = buildConversationDecisionShadow({
      latestMessage: "Sim, mostra Milano",
      history: [],
      lead: baseLead({ pending_property_offer: firenzeOffer() }),
      pendingPropertyOffer: firenzeOffer(),
      language: "pt",
      inventorySummary: {
        matchCount: 2,
        alternativeCities: [],
        criteriaMissing: false,
      },
    });

    assert.equal(decision.contextUse.userOverrodePendingOffer, true);
    assert.equal(decision.criteria.city, "Milano");
    assert.equal(shouldApplyPhaseBCityOverride(decision), true);
  });

  it("does not apply for simple Sim without override", () => {
    const decision = buildConversationDecisionShadow({
      latestMessage: "Sim",
      history: [],
      lead: baseLead({ pending_property_offer: firenzeOffer() }),
      pendingPropertyOffer: firenzeOffer(),
      language: "pt",
      inventorySummary: {
        matchCount: 1,
        alternativeCities: [],
        criteriaMissing: false,
      },
    });

    assert.equal(decision.contextUse.userOverrodePendingOffer, false);
    assert.equal(decision.contextUse.usedPendingOffer, true);
    assert.equal(decision.criteria.city, "Firenze");
    assert.equal(shouldApplyPhaseBCityOverride(decision), false);
  });
});

describe("Phase B city override criteria", () => {
  it("Sim, mostra Milano resolves Milano with userOverrodePendingOffer", () => {
    const offer = firenzeOffer();
    const resolved = resolveCriteriaShadow(
      "Sim, mostra Milano",
      baseLead({ pending_property_offer: offer }),
      offer
    );

    assert.equal(resolved.criteria.city, "Milano");
    assert.equal(resolved.contextUse.userOverrodePendingOffer, true);
    assert.equal(resolved.contextUse.usedPendingOffer, false);

    const searchCriteria = decisionCriteriaToSearchCriteria(resolved.criteria);
    assert.equal(searchCriteria?.city, "Milano");
    assert.notEqual(searchCriteria?.city, "Firenze");
  });

  it("Sim alone keeps Firenze pending offer city", () => {
    const offer = firenzeOffer();
    const resolved = resolveCriteriaShadow("Sim", baseLead(), offer);

    assert.equal(resolved.criteria.city, "Firenze");
    assert.equal(resolved.contextUse.usedPendingOffer, true);
    assert.equal(resolved.contextUse.userOverrodePendingOffer, false);
  });

  it("Sim, mostra Milano with Milano offer does not flag override", () => {
    const offer = milanoOffer();
    const resolved = resolveCriteriaShadow(
      "Sim, mostra Milano",
      baseLead({ pending_property_offer: offer }),
      offer
    );

    assert.equal(resolved.criteria.city, "Milano");
    assert.equal(resolved.contextUse.userOverrodePendingOffer, false);
    assert.equal(resolved.contextUse.usedPendingOffer, true);
  });
});

describe("filterPropertiesForDecisionCity", () => {
  const firenzeProperty: Property = {
    id: "p-firenze",
    user_id: "user-1",
    workspace_id: "ws-1",
    title: "Trilocale",
    city: "Firenze",
    neighborhood: "Novoli",
    property_type: "apartamento",
    price: 600000,
    bedrooms: 3,
    bathrooms: 2,
    description: null,
    image_url: null,
    listing_url: null,
    created_at: new Date().toISOString(),
  };

  const milanoProperty: Property = {
    ...firenzeProperty,
    id: "p-milano",
    city: "Milano",
    neighborhood: "Navigli",
  };

  it("drops cards from old pending offer city when override is Milano", () => {
    const filtered = filterPropertiesForDecisionCity(
      [firenzeProperty, milanoProperty],
      "Milano"
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.city, "Milano");
  });

  it("returns empty when only old city properties exist", () => {
    const filtered = filterPropertiesForDecisionCity([firenzeProperty], "Milano");
    assert.equal(filtered.length, 0);
  });
});

describe("decisionCriteriaToSearchCriteria", () => {
  it("builds relaxed search criteria from decision output", () => {
    const criteria = decisionCriteriaToSearchCriteria({
      city: "Milano",
      neighborhood: null,
      budget: null,
      propertyType: "moradia",
      buyRentIntent: null,
    });

    assert.ok(criteria);
    assert.equal(criteria?.city, "Milano");
    assert.equal(criteria?.propertyType, "moradia");
  });
});
