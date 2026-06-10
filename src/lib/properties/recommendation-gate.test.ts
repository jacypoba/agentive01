import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPropertyRecommendationGateCriteria,
  evaluatePropertyRecommendationGate,
} from "@/lib/properties/recommendation-gate";
import { derivePropertySearchDebug } from "@/lib/properties/search-criteria";
import { classifyMessageIntent } from "@/lib/ai/intent-classifier";
import type { Conversation, Lead } from "@/types/database";

const LEAD_ID = "lead-gate-test";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: LEAD_ID,
    user_id: "user-1",
    workspace_id: "ws-1",
    client_name: "Test Lead",
    phone: "+3900000000",
    phone_normalized: "+3900000000",
    status: "new",
    interest: null,
    budget: null,
    preferred_area: null,
    property_type: null,
    timeline: null,
    intent_status: null,
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: "it",
    pending_property_offer: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function clientMessage(text: string): Conversation {
  return {
    id: `client-${text.slice(0, 16)}`,
    lead_id: LEAD_ID,
    workspace_id: "ws-1",
    message: text,
    sender: "client",
    created_at: new Date().toISOString(),
  };
}

function evaluateMessage(
  text: string,
  language: "it" | "pt" | "en" | "es" | "fr" = "it",
  leadOverrides: Partial<Lead> = {}
) {
  const lead = makeLead({ preferred_language: language, ...leadOverrides });
  const history = [clientMessage(text)];
  const searchDebug = derivePropertySearchDebug(lead, history, {
    preferLatestMessage: true,
    relaxed: true,
  });
  const classified = classifyMessageIntent(history, lead);

  return evaluatePropertyRecommendationGate({
    leadId: LEAD_ID,
    lead,
    history,
    searchDebug,
    classified,
    language,
    hasPropertiesToSend: true,
    isReshow: false,
  });
}

describe("Property recommendation gate V1", () => {
  it('blocks "Salve, sto cercando una casa a Milano" with qualifying question', () => {
    const gate = evaluateMessage("Salve, sto cercando una casa a Milano");

    assert.equal(gate.shouldSendRecommendations, false);
    assert.equal(gate.reason, "broad_search_needs_qualification");
    assert.match(gate.qualifyingReply ?? "", /acquistare|affittare|zona|budget/i);
    assert.equal(gate.criteria.city, "Milano");
    assert.equal(gate.criteria.budget, null);
    assert.equal(gate.criteria.neighborhood, null);
  });

  it('blocks "Cerco appartamento a Milano" with qualifying question', () => {
    const gate = evaluateMessage("Cerco appartamento a Milano");

    assert.equal(gate.shouldSendRecommendations, false);
    assert.equal(gate.reason, "broad_search_needs_qualification");
    assert.ok(gate.qualifyingReply);
    assert.equal(gate.criteria.propertyType, "apartamento");
  });

  it('allows "Cerco casa a Milano fino a 800 mila euro"', () => {
    const gate = evaluateMessage("Cerco casa a Milano fino a 800 mila euro");

    assert.equal(gate.shouldSendRecommendations, true);
    assert.equal(gate.reason, "enough_criteria");
    assert.equal(gate.qualifyingReply, null);
    assert.equal(gate.criteria.city, "Milano");
    assert.ok(gate.criteria.budget != null && gate.criteria.budget >= 800_000);
  });

  it('allows "Cerco casa a Milano zona Navigli"', () => {
    const gate = evaluateMessage("Cerco casa a Milano zona Navigli");

    assert.equal(gate.shouldSendRecommendations, true);
    assert.equal(gate.reason, "enough_criteria");
    assert.match(gate.criteria.neighborhood ?? "", /navigli/i);
  });

  it('allows "Mostrami le opzioni a Milano" via ask_more_options bypass', () => {
    const lead = makeLead({ preferred_language: "it" });
    const history = [clientMessage("Mostrami le opzioni a Milano")];
    const classified = classifyMessageIntent(history, lead);

    assert.equal(classified.intent, "ask_more_options");

    const gate = evaluatePropertyRecommendationGate({
      leadId: LEAD_ID,
      lead,
      history,
      searchDebug: derivePropertySearchDebug(lead, history, {
        preferLatestMessage: true,
        relaxed: true,
      }),
      classified,
      language: "it",
      hasPropertiesToSend: true,
      isReshow: false,
    });

    assert.equal(gate.shouldSendRecommendations, true);
    assert.equal(gate.reason, "not_applicable");
  });

  it("detects explicit show request criteria on property_search edge case", () => {
    const lead = makeLead({ preferred_language: "en" });
    const history = [clientMessage("Show me available homes in Milan")];
    const searchDebug = derivePropertySearchDebug(lead, history, {
      preferLatestMessage: true,
      relaxed: true,
    });
    const classified = classifyMessageIntent(history, lead);

    const gate = evaluatePropertyRecommendationGate({
      leadId: LEAD_ID,
      lead,
      history,
      searchDebug,
      classified,
      language: "en",
      hasPropertiesToSend: true,
      isReshow: false,
    });

    assert.equal(gate.shouldSendRecommendations, true);
    assert.equal(
      gate.reason === "explicit_show_request" || gate.reason === "not_applicable",
      true
    );
    assert.equal(gate.criteria.explicitShowRequest, true);
  });

  it('blocks broad PT search "Procuro casa em Milano"', () => {
    const gate = evaluateMessage("Procuro casa em Milano", "pt");

    assert.equal(gate.shouldSendRecommendations, false);
    assert.equal(gate.reason, "broad_search_needs_qualification");
    assert.match(gate.qualifyingReply ?? "", /comprar|arrendar/i);
  });

  it('blocks broad EN search "I\'m looking for a house in Milan"', () => {
    const gate = evaluateMessage("I'm looking for a house in Milan", "en");

    assert.equal(gate.shouldSendRecommendations, false);
    assert.equal(gate.reason, "broad_search_needs_qualification");
    assert.match(gate.qualifyingReply ?? "", /buy or rent/i);
  });

  it('blocks broad ES search "Busco casa en Milán"', () => {
    const gate = evaluateMessage("Busco casa en Milán", "es");

    assert.equal(gate.shouldSendRecommendations, false);
    assert.equal(gate.reason, "broad_search_needs_qualification");
    assert.match(gate.qualifyingReply ?? "", /comprar o alquilar/i);
  });

  it('blocks broad FR search "Je cherche une maison à Milan"', () => {
    const lead = makeLead({ preferred_language: "fr" });
    const history = [clientMessage("Je cherche une maison à Milan")];
    const searchDebug = derivePropertySearchDebug(lead, history, {
      preferLatestMessage: true,
      relaxed: true,
    });
    const classified = {
      intent: "property_search" as const,
      wantsReshow: false,
      wantsMore: false,
      latestMessage: history[0]!.message,
    };

    const gate = evaluatePropertyRecommendationGate({
      leadId: LEAD_ID,
      lead,
      history,
      searchDebug,
      classified,
      language: "fr",
      hasPropertiesToSend: true,
      isReshow: false,
    });

    assert.equal(gate.shouldSendRecommendations, false);
    assert.equal(gate.reason, "broad_search_needs_qualification");
    assert.match(gate.qualifyingReply ?? "", /acheter ou à louer/i);
  });

  it("allows when budget is stored on the lead", () => {
    const gate = evaluateMessage("Cerco casa a Milano", "it", {
      budget: "800000",
    });

    assert.equal(gate.shouldSendRecommendations, true);
    assert.equal(gate.reason, "enough_criteria");
    assert.ok(gate.criteria.budget != null);
  });

  it("buildPropertyRecommendationGateCriteria exposes parsed signals", () => {
    const lead = makeLead();
    const history = [clientMessage("Cerco appartamento a Milano zona Navigli fino a 500 mila")];
    const searchDebug = derivePropertySearchDebug(lead, history, {
      preferLatestMessage: true,
      relaxed: true,
    });

    const criteria = buildPropertyRecommendationGateCriteria(
      lead,
      history,
      searchDebug
    );

    assert.equal(criteria.city, "Milano");
    assert.equal(criteria.propertyType, "apartamento");
    assert.ok(criteria.budget != null);
    assert.match(criteria.neighborhood ?? "", /navigli/i);
  });
});
