import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConversationDecisionShadow,
  extractBroadPropertyType,
  resolveCriteriaShadow,
} from "@/lib/ai/conversation-decision";
import type { Conversation, Lead, PendingPropertyOffer } from "@/types/database";

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

function baseLead(partial: Partial<Lead> = {}): Lead {
  return {
    id: "lead-shadow-1",
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

function clientMessage(text: string): Conversation {
  return {
    id: `msg-${text.slice(0, 12)}`,
    lead_id: "lead-shadow-1",
    workspace_id: "ws-1",
    message: text,
    sender: "client",
    created_at: new Date().toISOString(),
  };
}

describe("resolveCriteriaShadow pending offer precedence", () => {
  it('uses Milano when user says "Sim, mostra Milano" after Firenze offer', () => {
    const lead = baseLead({ pending_property_offer: firenzeOffer() });
    const resolved = resolveCriteriaShadow(
      "Sim, mostra Milano",
      lead,
      firenzeOffer()
    );

    assert.equal(resolved.criteria.city, "Milano");
    assert.equal(resolved.contextUse.userOverrodePendingOffer, true);
    assert.equal(resolved.contextUse.usedPendingOffer, false);
  });

  it('uses Firenze when user says "Sim" after Firenze offer', () => {
    const offer = firenzeOffer();
    const lead = baseLead({ pending_property_offer: offer });
    const resolved = resolveCriteriaShadow("Sim", lead, offer);

    assert.equal(resolved.criteria.city, "Firenze");
    assert.equal(resolved.contextUse.usedPendingOffer, true);
    assert.equal(resolved.contextUse.userOverrodePendingOffer, false);
    assert.equal(resolved.criteria.neighborhood, "Novoli");
  });

  it('uses Roma when user says "não, quero Roma"', () => {
    const offer = firenzeOffer();
    const lead = baseLead({ pending_property_offer: offer });
    const resolved = resolveCriteriaShadow("não, quero Roma", lead, offer);

    assert.equal(resolved.criteria.city, "Roma");
    assert.equal(resolved.contextUse.userOverrodePendingOffer, true);
    assert.equal(resolved.contextUse.usedPendingOffer, false);
  });
});

describe("buildConversationDecisionShadow actions", () => {
  it('returns show_city_alternatives for Roma search with zero matches and Milano alts', () => {
    const decision = buildConversationDecisionShadow({
      latestMessage: "Procuro casa em Roma",
      history: [clientMessage("Procuro casa em Roma")],
      lead: baseLead({ pending_property_offer: null }),
      pendingPropertyOffer: null,
      language: "pt",
      inventorySummary: {
        matchCount: 0,
        alternativeCities: ["Milano"],
        criteriaMissing: false,
      },
    });

    assert.equal(decision.action, "show_city_alternatives");
    assert.equal(decision.criteria.city, "Roma");
    assert.equal(decision.reason, "zero_match_with_alternative_cities");
  });

  it("returns ask_clarifying_question for broad Milano search with matches", () => {
    const decision = buildConversationDecisionShadow({
      latestMessage: "Procuro casa em Milano",
      history: [clientMessage("Procuro casa em Milano")],
      lead: baseLead({ pending_property_offer: null, preferred_area: null }),
      pendingPropertyOffer: null,
      language: "it",
      inventorySummary: {
        matchCount: 3,
        alternativeCities: [],
        criteriaMissing: false,
      },
    });

    assert.equal(decision.action, "ask_clarifying_question");
    assert.equal(decision.criteria.city, "Milano");
    assert.ok(decision.missingCriteria.includes("budget"));
  });

  it("returns show_properties when pending offer accepted and inventory exists", () => {
    const offer = firenzeOffer();
    const decision = buildConversationDecisionShadow({
      latestMessage: "Sim",
      history: [clientMessage("Sim")],
      lead: baseLead({ pending_property_offer: offer }),
      pendingPropertyOffer: offer,
      language: "pt",
      inventorySummary: {
        matchCount: 2,
        alternativeCities: [],
        criteriaMissing: false,
      },
    });

    assert.equal(decision.action, "show_properties");
    assert.equal(decision.criteria.city, "Firenze");
    assert.equal(decision.contextUse.usedPendingOffer, true);
  });
});

describe("extractBroadPropertyType bedroom inference guard", () => {
  it("does not infer trilocale from lead memory", () => {
    const result = extractBroadPropertyType("Procuro casa em Roma", "trilocale");
    assert.equal(result.propertyType, "moradia");
    assert.equal(result.fromLatest, true);
    assert.equal(result.fromLead, false);
  });

  it("does not use T3 from lead when latest message has no type", () => {
    const result = extractBroadPropertyType("Milano per favore", "T3");
    assert.equal(result.propertyType, null);
    assert.equal(result.fromLead, false);
  });

  it("maps explicit trilocale in message to broad apartamento", () => {
    const result = extractBroadPropertyType("Cerco un trilocale a Milano", null);
    assert.equal(result.propertyType, "apartamento");
    assert.equal(result.fromLatest, true);
  });
});

describe("buildConversationDecisionShadow multilingual", () => {
  const multilingualCases: Array<{
    lang: "pt" | "it" | "en" | "es" | "fr";
    message: string;
    expectedCity: string;
    offer?: PendingPropertyOffer | null;
  }> = [
    { lang: "it", message: "Sì, va bene", expectedCity: "Firenze", offer: firenzeOffer() },
    { lang: "it", message: "No, preferisco Roma", expectedCity: "Roma", offer: firenzeOffer() },
    { lang: "es", message: "Sí, por favor", expectedCity: "Firenze", offer: firenzeOffer() },
    { lang: "es", message: "Busco en Madrid", expectedCity: "Madrid", offer: firenzeOffer() },
    { lang: "fr", message: "Oui montrez-moi", expectedCity: "Firenze", offer: firenzeOffer() },
    { lang: "en", message: "Yes please", expectedCity: "Firenze", offer: firenzeOffer() },
    { lang: "en", message: "Actually London instead", expectedCity: "London", offer: firenzeOffer() },
    { lang: "pt", message: "Sim, mostra Milano", expectedCity: "Milano", offer: firenzeOffer() },
  ];

  for (const { lang, message, expectedCity, offer = firenzeOffer() } of multilingualCases) {
    it(`[${lang}] "${message}" → city ${expectedCity}`, () => {
      const decision = buildConversationDecisionShadow({
        latestMessage: message,
        history: [clientMessage(message)],
        lead: baseLead({ pending_property_offer: offer, preferred_language: lang }),
        pendingPropertyOffer: offer,
        language: lang,
        inventorySummary: {
          matchCount: 1,
          alternativeCities: [],
          criteriaMissing: false,
        },
      });

      assert.equal(decision.criteria.city, expectedCity);
    });
  }
});

describe("buildConversationDecisionShadow schema", () => {
  it("returns full decision object shape", () => {
    const decision = buildConversationDecisionShadow({
      latestMessage: "Quanto custa?",
      history: [clientMessage("Quanto custa?")],
      lead: baseLead({ pending_property_offer: null }),
      pendingPropertyOffer: null,
      language: "pt",
      inventorySummary: {
        matchCount: 0,
        alternativeCities: [],
        criteriaMissing: true,
      },
    });

    assert.ok(decision.action);
    assert.equal(decision.language, "pt");
    assert.ok("city" in decision.criteria);
    assert.ok("usedPendingOffer" in decision.contextUse);
    assert.ok(Array.isArray(decision.missingCriteria));
    assert.ok(decision.reason);
    assert.ok(decision.confidence);
    assert.ok(decision.replyInstruction);
  });
});
