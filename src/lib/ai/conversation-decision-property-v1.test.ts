import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { classifyMessageIntent } from "@/lib/ai/intent-classifier";
import {
  buildConversationDecisionShadow,
  buildPropertyConversationDecision,
  executePropertyDecision,
  extractBroadPropertyType,
  isConversationDecisionEnginePropertyV1Enabled,
  isPropertyRelatedTurn,
  resolveCriteriaShadow,
  tryApplyPropertyDecisionV1,
} from "@/lib/ai/conversation-decision";
import type { Lead, PendingPropertyOffer, Property } from "@/types/database";

const ORIGINAL_PROPERTY_V1 =
  process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1;

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
    id: "lead-v1-1",
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
    created_at: new Date().toISOString(),
  };
}

const milanoNavigli = property({
  id: "milano-navigli",
  city: "Milano",
  neighborhood: "Navigli",
});

const romaProperty = property({
  id: "roma-1",
  city: "Roma",
});

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

describe("isConversationDecisionEnginePropertyV1Enabled", () => {
  afterEach(() => {
    if (ORIGINAL_PROPERTY_V1 === undefined) {
      delete process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1;
    } else {
      process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1 = ORIGINAL_PROPERTY_V1;
    }
  });

  it("is false by default", () => {
    delete process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1;
    assert.equal(isConversationDecisionEnginePropertyV1Enabled(), false);
  });

  it("is true when CONVERSATION_DECISION_ENGINE_PROPERTY_V1=true", () => {
    process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1 = "true";
    assert.equal(isConversationDecisionEnginePropertyV1Enabled(), true);
  });
});

describe("isPropertyRelatedTurn", () => {
  it("includes general_question city pivot", () => {
    const message =
      "Firenze non mi piace come opzione, avete qualcosa a Milano?";
    const lead = baseLead({ preferred_language: "it" });
    const history = [
      {
        id: "1",
        lead_id: lead.id,
        workspace_id: "ws-1",
        message,
        sender: "client" as const,
        created_at: "",
      },
    ];
    const classified = classifyMessageIntent(history, lead);

    assert.equal(classified.intent, "general_question");
    assert.equal(
      isPropertyRelatedTurn(message, history, classified, lead, firenzeOffer()),
      true
    );
  });

  it("includes explicit show-options complaint", () => {
    const message =
      "fai troppe domande, fammi vedere le opzioni che hai a Milano";
    const lead = baseLead({ preferred_language: "it", pending_property_offer: null });
    const history = [
      {
        id: "1",
        lead_id: lead.id,
        workspace_id: "ws-1",
        message,
        sender: "client" as const,
        created_at: "",
      },
    ];
    const classified = classifyMessageIntent(history, lead);

    assert.equal(
      isPropertyRelatedTurn(message, history, classified, lead, null),
      true
    );
  });
});

describe("executePropertyDecision regression cases", () => {
  it("PT pivot shows Milano properties", async () => {
    const message = "Firenze fica longe para mim, tens algo em Milano?";
    const lead = baseLead();
    const built = await buildPropertyConversationDecision(
      mockSupabase([milanoNavigli]) as never,
      lead,
      [],
      message,
      "pt",
      firenzeOffer()
    );

    const execution = executePropertyDecision({
      built,
      history: [],
      leadId: lead.id,
      language: "pt",
    });

    assert.equal(execution.decision.action, "show_properties");
    assert.equal(execution.decision.criteria.city, "Milano");
    assert.equal(execution.propertiesToRecommend.length, 1);
    assert.equal(execution.qualifyingReply, null);
  });

  it("IT pivot shows Milano properties", async () => {
    const message =
      "Firenze non mi piace come opzione, avete qualcosa a Milano?";
    const lead = baseLead({ preferred_language: "it" });
    const built = await buildPropertyConversationDecision(
      mockSupabase([milanoNavigli]) as never,
      lead,
      [],
      message,
      "it",
      firenzeOffer()
    );
    const execution = executePropertyDecision({
      built,
      history: [],
      leadId: lead.id,
      language: "it",
    });

    assert.equal(execution.decision.action, "show_properties");
    assert.equal(execution.propertiesToRecommend[0]?.city, "Milano");
  });

  it("complaint + show Milano options bypasses broad qualification", () => {
    const message =
      "fai troppe domande, fammi vedere le opzioni che hai a Milano";
    const history = [
      {
        id: "1",
        lead_id: "lead-v1-1",
        workspace_id: "ws-1",
        message,
        sender: "client" as const,
        created_at: "",
      },
    ];
    const decision = buildConversationDecisionShadow({
      latestMessage: message,
      history,
      lead: baseLead({ preferred_language: "it", pending_property_offer: null }),
      pendingPropertyOffer: null,
      language: "it",
      inventorySummary: {
        matchCount: 2,
        alternativeCities: [],
        criteriaMissing: false,
      },
    });

    assert.equal(decision.action, "show_properties");
    assert.equal(decision.criteria.city, "Milano");
  });

  it("Rome search with no stock offers city alternatives", () => {
    const message = "hi, I'm looking for a house in Rome";
    const decision = buildConversationDecisionShadow({
      latestMessage: message,
      history: [
        {
          id: "1",
          lead_id: "lead-v1-1",
          workspace_id: "ws-1",
          message,
          sender: "client" as const,
          created_at: "",
        },
      ],
      lead: baseLead({
        preferred_language: "en",
        pending_property_offer: null,
        preferred_area: null,
      }),
      pendingPropertyOffer: null,
      language: "en",
      inventorySummary: {
        matchCount: 0,
        alternativeCities: ["Milano"],
        criteriaMissing: false,
      },
    });

    const execution = executePropertyDecision({
      built: {
        decision,
        resolved: resolveCriteriaShadow(message, baseLead({ pending_property_offer: null }), null),
        matchingProperties: [],
        cityAlternatives: {
          requestedCity: "Roma",
          availableCities: ["Milano"],
          availableAreas: ["Navigli"],
          primaryCity: "Milano",
          primaryAreas: ["Navigli"],
        },
        searchCriteria: {
          city: "Roma",
          propertyType: "moradia",
          maxBudget: undefined,
        },
      },
      history: [],
      leadId: "lead-v1-1",
      language: "en",
    });

    assert.equal(decision.action, "show_city_alternatives");
    assert.equal(decision.criteria.city, "Roma");
    assert.ok(execution.qualifyingReply);
  });

  it("Não quero Roma, prefiro Milano resolves Milano", () => {
    const message = "Não quero Roma, prefiro Milano";
    const resolved = resolveCriteriaShadow(message, baseLead(), firenzeOffer());
    assert.equal(resolved.criteria.city, "Milano");
    assert.equal(resolved.contextUse.userOverrodePendingOffer, true);
  });

  it("Sim, por favor uses Firenze offer when no override", () => {
    const offer = firenzeOffer();
    const resolved = resolveCriteriaShadow("Sim, por favor", baseLead(), offer);
    assert.equal(resolved.criteria.city, "Firenze");
    assert.equal(resolved.contextUse.usedPendingOffer, true);
    assert.equal(resolved.contextUse.userOverrodePendingOffer, false);
  });

  it("Sim, mostra Milano overrides Firenze offer", () => {
    const offer = firenzeOffer();
    const resolved = resolveCriteriaShadow("Sim, mostra Milano", baseLead(), offer);
    assert.equal(resolved.criteria.city, "Milano");
    assert.equal(resolved.contextUse.userOverrodePendingOffer, true);
  });

  it("broad Milano search with inventory asks at most one question", () => {
    const message = "Procuro casa em Milano";
    const decision = buildConversationDecisionShadow({
      latestMessage: message,
      history: [
        {
          id: "1",
          lead_id: "lead-v1-1",
          workspace_id: "ws-1",
          message,
          sender: "client" as const,
          created_at: "",
        },
      ],
      lead: baseLead({ pending_property_offer: null, preferred_area: null }),
      pendingPropertyOffer: null,
      language: "pt",
      inventorySummary: {
        matchCount: 3,
        alternativeCities: [],
        criteriaMissing: false,
      },
    });

    assert.equal(decision.action, "ask_clarifying_question");
    assert.equal(decision.reason, "broad_search_needs_qualification");
  });

  it("does not infer trilocale from generic casa", () => {
    const result = extractBroadPropertyType("Procuro casa em Roma", "trilocale");
    assert.equal(result.propertyType, "moradia");
    assert.equal(result.fromLead, false);
  });
});

describe("tryApplyPropertyDecisionV1", () => {
  afterEach(() => {
    if (ORIGINAL_PROPERTY_V1 === undefined) {
      delete process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1;
    } else {
      process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1 = ORIGINAL_PROPERTY_V1;
    }
  });

  it("returns null when flag is disabled", async () => {
    delete process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1;
    const lead = baseLead();
    const message = "Firenze fica longe para mim, tens algo em Milano?";
    const history = [
      {
        id: "1",
        lead_id: lead.id,
        workspace_id: "ws-1",
        message,
        sender: "client" as const,
        created_at: "",
      },
    ];
    const classified = classifyMessageIntent(history, lead);

    const result = await tryApplyPropertyDecisionV1(
      mockSupabase([milanoNavigli]) as never,
      lead,
      history,
      message,
      classified,
      firenzeOffer(),
      "pt"
    );

    assert.equal(result, null);
  });

  it("shows Milano for PT pivot when enabled", async () => {
    process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1 = "true";
    const lead = baseLead();
    const message = "Firenze fica longe para mim, tens algo em Milano?";
    const history = [
      {
        id: "1",
        lead_id: lead.id,
        workspace_id: "ws-1",
        message,
        sender: "client" as const,
        created_at: "",
      },
    ];
    const classified = classifyMessageIntent(history, lead);

    const result = await tryApplyPropertyDecisionV1(
      mockSupabase([milanoNavigli]) as never,
      lead,
      history,
      message,
      classified,
      firenzeOffer(),
      "pt"
    );

    assert.ok(result);
    assert.equal(result?.decision.action, "show_properties");
    assert.equal(result?.decision.criteria.city, "Milano");
    assert.equal(result?.propertiesToRecommend.length, 1);
    assert.equal(result?.completePendingOffer, true);
  });
});
