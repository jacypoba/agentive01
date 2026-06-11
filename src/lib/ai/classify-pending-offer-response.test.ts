import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyMessageIntent,
  shouldQueryProperties,
} from "@/lib/ai/intent-classifier";
import {
  classifyPendingOfferResponse,
  shouldAcceptPendingOfferResponse,
} from "@/lib/ai/classify-pending-offer-response";
import type { Conversation, Lead, PendingPropertyOffer } from "@/types/database";

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

function baseLead(): Lead {
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
    pending_property_offer: pendingMilanoOffer(),
    created_at: new Date().toISOString(),
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

describe("classifyPendingOfferResponse acceptance", () => {
  const offer = pendingMilanoOffer();

  const acceptanceCases = [
    "Sim, por favor",
    "sim pode mandar",
    "ok, mostra-me",
    "claro, quero ver",
    "yes please",
    "sure, show me",
    "sì grazie",
    "va bene, mostrami",
    "oui, montre-moi",
    "sí, muéstrame",
  ];

  for (const message of acceptanceCases) {
    it(`accepts "${message}"`, () => {
      const result = classifyPendingOfferResponse(message, offer);
      assert.equal(result.decision, "accept");
      assert.ok(shouldAcceptPendingOfferResponse(result));
    });
  }
});

describe("classifyPendingOfferResponse new search", () => {
  const offer = pendingMilanoOffer();

  const newSearchCases = [
    "Sim, procuro casa em Lisboa",
    "yes, I want a house in London",
    "sì, cerco casa a Roma",
    "oui, je cherche une maison à Paris",
    "ok, mas agora quero em Firenze",
    "não, quero em Roma",
  ];

  for (const message of newSearchCases) {
    it(`does not accept "${message}"`, () => {
      const result = classifyPendingOfferResponse(message, offer);
      assert.equal(result.decision, "new_search");
      assert.equal(shouldAcceptPendingOfferResponse(result), false);
    });
  }
});

describe("classifyPendingOfferResponse unclear", () => {
  const offer = pendingMilanoOffer();

  it("does not force acceptance on long unrelated message", () => {
    const message =
      "Estou a pensar na mudança para Itália e gostaria de perceber melhor como funciona o processo de compra com vocês antes de decidir qualquer coisa concreta sobre imóveis.";
    const result = classifyPendingOfferResponse(message, offer);
    assert.equal(result.decision, "unclear");
    assert.equal(shouldAcceptPendingOfferResponse(result), false);
  });

  it("accepts short unclear affirmatives", () => {
    for (const message of ["ok", "certo", "claro", "va bene"]) {
      const result = classifyPendingOfferResponse(message, offer);
      assert.equal(result.decision, "accept");
      assert.ok(shouldAcceptPendingOfferResponse(result));
    }
  });
});

describe("classifyMessageIntent with pending offer response", () => {
  const lead = baseLead();

  it('routes "Sim, por favor" to accept_pending_offer', () => {
    const result = classifyMessageIntent([clientMessage("Sim, por favor")], lead);
    assert.equal(result.intent, "accept_pending_offer");
    assert.equal(shouldQueryProperties(result), true);
  });

  it('does not accept "Sim, procuro casa em Lisboa" as pending offer', () => {
    const result = classifyMessageIntent(
      [clientMessage("Sim, procuro casa em Lisboa")],
      lead
    );
    assert.notEqual(result.intent, "accept_pending_offer");
  });

  it("does not accept without pending offer", () => {
    const leadWithoutOffer = { ...lead, pending_property_offer: null };
    const result = classifyMessageIntent(
      [clientMessage("Sim, por favor")],
      leadWithoutOffer
    );
    assert.notEqual(result.intent, "accept_pending_offer");
  });
});

describe("Sim, por favor before/after", () => {
  const offer = pendingMilanoOffer();

  it("before: phrase-only matcher rejected polite affirmative", () => {
    const legacyPattern = new RegExp(
      "^\\b(sim|sì|si|yes|yeah|yep|oui|ok|okay|sí|ja)[\\s,!.]*$",
      "i"
    );
    assert.equal(legacyPattern.test("Sim, por favor"), false);
  });

  it("after: evidence-based classifier accepts", () => {
    const result = classifyPendingOfferResponse("Sim, por favor", offer);
    assert.equal(result.decision, "accept");
    assert.equal(result.confidence, "high");
    assert.ok(result.evidence.includes("accept:affirmative"));
    assert.ok(result.evidence.includes("accept:polite"));
    assert.ok(shouldAcceptPendingOfferResponse(result));
  });
});
