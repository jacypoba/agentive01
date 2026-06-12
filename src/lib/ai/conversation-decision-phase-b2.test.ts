import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  classifyMessageIntent,
  shouldQueryProperties,
} from "@/lib/ai/intent-classifier";
import {
  extractBroadPropertyType,
  hasPropertyPivotEvidence,
  isConversationDecisionEnginePhaseB2Enabled,
  resolveCriteriaShadow,
  shouldApplyPhaseB2PropertyPivot,
  tryApplyPhaseB2PropertyPivot,
} from "@/lib/ai/conversation-decision";
import { buildConversationDecisionShadow, selectActionShadowForPivot } from "@/lib/ai/conversation-decision";
import type { Lead, PendingPropertyOffer, Property } from "@/types/database";

const ORIGINAL_PHASE_B2 = process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2;

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
    id: "lead-b2-1",
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

const PIVOT_CASES: Array<{
  lang: Lead["preferred_language"];
  message: string;
  expectedCity: string;
}> = [
  {
    lang: "pt",
    message: "Firenze fica longe para mim, tens algo em Milano?",
    expectedCity: "Milano",
  },
  {
    lang: "it",
    message: "Firenze non mi piace come opzione, avete qualcosa a Milano?",
    expectedCity: "Milano",
  },
  {
    lang: "en",
    message: "Rome doesn't work for me, show me Milan",
    expectedCity: "Milano",
  },
  {
    lang: "fr",
    message: "Je ne veux pas Rome, je préfère Milan",
    expectedCity: "Milano",
  },
  {
    lang: "es",
    message: "No quiero Roma, prefiero Milán",
    expectedCity: "Milano",
  },
];

describe("isConversationDecisionEnginePhaseB2Enabled", () => {
  afterEach(() => {
    if (ORIGINAL_PHASE_B2 === undefined) {
      delete process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2;
    } else {
      process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2 = ORIGINAL_PHASE_B2;
    }
  });

  it("is false by default", () => {
    delete process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2;
    assert.equal(isConversationDecisionEnginePhaseB2Enabled(), false);
  });

  it("is true when CONVERSATION_DECISION_ENGINE_PHASE_B2=true", () => {
    process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2 = "true";
    assert.equal(isConversationDecisionEnginePhaseB2Enabled(), true);
  });
});

describe("hasPropertyPivotEvidence", () => {
  for (const { lang, message, expectedCity } of PIVOT_CASES) {
    it(`detects pivot for ${lang}: ${expectedCity}`, () => {
      const offer = firenzeOffer();
      const resolved = resolveCriteriaShadow(message, baseLead({ preferred_language: lang }), offer);
      assert.equal(resolved.criteria.city, expectedCity);
      assert.equal(
        hasPropertyPivotEvidence(resolved, message, offer),
        true
      );
    });
  }

  it("rejects generic non-property question", () => {
    const message = "Quali sono i vostri orari di apertura?";
    const resolved = resolveCriteriaShadow(message, baseLead({ preferred_language: "it" }), null);
    assert.equal(hasPropertyPivotEvidence(resolved, message, null), false);
  });

  it("rejects broad first search without pivot", () => {
    const message = "Salve, sto cercando una casa a Milano";
    const resolved = resolveCriteriaShadow(message, baseLead({ preferred_language: "it" }), null);
    assert.equal(hasPropertyPivotEvidence(resolved, message, null), false);
  });
});

describe("Phase B2 legacy intent mismatch", () => {
  it("IT pivot is general_question in legacy but has pivot evidence", () => {
    const message = "Firenze non mi piace come opzione, avete qualcosa a Milano?";
    const lead = baseLead({ preferred_language: "it" });
    const history = [{ id: "1", lead_id: lead.id, workspace_id: "ws-1", message, sender: "client" as const, created_at: "" }];
    const classified = classifyMessageIntent(history, lead);

    assert.equal(classified.intent, "general_question");
    assert.equal(shouldQueryProperties(classified), false);

    const resolved = resolveCriteriaShadow(message, lead, firenzeOffer());
    assert.equal(hasPropertyPivotEvidence(resolved, message, firenzeOffer()), true);
  });
});

describe("extractBroadPropertyType — no trilocale inference", () => {
  it("does not infer apartamento from generic casa in pivot message", () => {
    const result = extractBroadPropertyType(
      "Je ne veux pas Rome, je préfère Milan",
      "trilocale"
    );
    assert.equal(result.fromLatest, false);
    assert.equal(result.propertyType, null);
  });

  it("uses lead moradia for generic house pivot when lead type is broad", () => {
    const result = extractBroadPropertyType(
      "Rome doesn't work for me, show me Milan",
      "moradia"
    );
    assert.equal(result.propertyType, "moradia");
    assert.equal(result.fromLead, true);
  });
});

describe("tryApplyPhaseB2PropertyPivot", () => {
  afterEach(() => {
    if (ORIGINAL_PHASE_B2 === undefined) {
      delete process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2;
    } else {
      process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2 = ORIGINAL_PHASE_B2;
    }
  });

  it("returns null when flag is disabled", async () => {
    delete process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2;
    const lead = baseLead();
    const message = PIVOT_CASES[0]!.message;
    const classified = classifyMessageIntent(
      [{ id: "1", lead_id: lead.id, workspace_id: "ws-1", message, sender: "client", created_at: "" }],
      lead
    );

    const result = await tryApplyPhaseB2PropertyPivot(
      mockSupabase([milanoNavigli]) as never,
      lead,
      [],
      message,
      classified,
      firenzeOffer(),
      "pt"
    );

    assert.equal(result, null);
  });

  for (const { lang, message, expectedCity } of PIVOT_CASES) {
    it(`searches ${expectedCity} for ${lang} pivot when enabled`, async () => {
      process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2 = "true";
      const lead = baseLead({ preferred_language: lang });
      const history = [{ id: "1", lead_id: lead.id, workspace_id: "ws-1", message, sender: "client" as const, created_at: "" }];
      const classified = classifyMessageIntent(history, lead);

      const result = await tryApplyPhaseB2PropertyPivot(
        mockSupabase([milanoNavigli]) as never,
        lead,
        history,
        message,
        classified,
        firenzeOffer(),
        lang ?? "pt"
      );

      assert.ok(result);
      assert.equal(result?.criteria?.city, expectedCity);
      assert.equal(result?.propertiesToRecommend.length, 1);
      assert.equal(result?.propertiesToRecommend[0]?.city, "Milano");
      assert.equal(result?.decision.action, "show_properties");
      assert.equal(result?.qualifyingReply, null);
      assert.equal(result?.completePendingOffer, true);
    });
  }

  it("returns qualifying reply when property type is missing", async () => {
    process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2 = "true";
    const message = "Je ne veux pas Rome, je préfère Milan";
    const lead = baseLead({
      preferred_language: "fr",
      property_type: "trilocale",
    });
    const offerWithoutType: PendingPropertyOffer = {
      ...firenzeOffer(),
      propertyType: undefined,
    };
    const classified = classifyMessageIntent(
      [{ id: "1", lead_id: lead.id, workspace_id: "ws-1", message, sender: "client", created_at: "" }],
      lead
    );

    const result = await tryApplyPhaseB2PropertyPivot(
      mockSupabase([milanoNavigli]) as never,
      lead,
      [],
      message,
      classified,
      offerWithoutType,
      "fr"
    );

    assert.ok(result);
    assert.equal(result?.propertiesToRecommend.length, 0);
    assert.ok(result?.qualifyingReply);
    assert.match(result?.qualifyingReply ?? "", /acheter|louer|type/i);
  });

  it("inherits pending offer property type on pivot", async () => {
    process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2 = "true";
    const message = "Je ne veux pas Rome, je préfère Milan";
    const lead = baseLead({
      preferred_language: "fr",
      property_type: "trilocale",
    });
    const classified = classifyMessageIntent(
      [{ id: "1", lead_id: lead.id, workspace_id: "ws-1", message, sender: "client", created_at: "" }],
      lead
    );

    const result = await tryApplyPhaseB2PropertyPivot(
      mockSupabase([milanoNavigli]) as never,
      lead,
      [],
      message,
      classified,
      firenzeOffer(),
      "fr"
    );

    assert.ok(result);
    assert.equal(result?.decision.criteria.propertyType, "moradia");
    assert.equal(result?.propertiesToRecommend.length, 1);
    assert.equal(result?.qualifyingReply, null);
  });
});

describe("selectActionShadowForPivot", () => {
  it("returns show_properties when inventory exists for pivot", () => {
    const message = PIVOT_CASES[1]!.message;
    const resolved = resolveCriteriaShadow(message, baseLead({ preferred_language: "it" }), firenzeOffer());
    const selected = selectActionShadowForPivot(message, resolved, {
      matchCount: 2,
      alternativeCities: [],
      criteriaMissing: false,
    });

    assert.equal(selected.action, "show_properties");
    assert.equal(selected.reason, "pivot_city_match_inventory");
  });
});

describe("shouldApplyPhaseB2PropertyPivot", () => {
  it("applies for show_properties pivot decision", () => {
    const message = PIVOT_CASES[0]!.message;
    const offer = firenzeOffer();
    const resolved = resolveCriteriaShadow(message, baseLead(), offer);
    const selected = selectActionShadowForPivot(message, resolved, {
      matchCount: 1,
      alternativeCities: [],
      criteriaMissing: false,
    });
    const decision = buildConversationDecisionShadow({
      latestMessage: message,
      history: [],
      lead: baseLead(),
      pendingPropertyOffer: offer,
      language: "pt",
      inventorySummary: { matchCount: 1, alternativeCities: [], criteriaMissing: false },
    });

    assert.equal(selected.action, "show_properties");
    assert.equal(
      shouldApplyPhaseB2PropertyPivot(
        { ...decision, action: selected.action, reason: selected.reason },
        resolved,
        message,
        offer
      ),
      true
    );
  });
});
