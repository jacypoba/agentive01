import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation, Lead } from "@/types/database";
import { violatesReplyGuardrails } from "@/lib/ai/guardrails";
import {
  classifyMessageIntent,
  shouldQueryProperties,
  shouldRunFreshPropertyQuery,
  shouldUseReshowBatch,
} from "@/lib/ai/intent-classifier";

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

function leadWithPendingOffer(): Lead {
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
    pending_property_offer: {
      offeredCity: "Milano",
      offeredAreas: ["Navigli"],
      source: "city_fallback",
      createdAt: new Date().toISOString(),
      status: "pending",
      requestedCity: "Roma",
      propertyType: "moradia",
    },
    created_at: new Date().toISOString(),
  };
}

function historyFrom(messages: string[]): Conversation[] {
  return messages.map(clientMessage);
}

describe("classifyMessageIntent", () => {
  it('classifies "está bem, obrigado" as thanks_or_closing', () => {
    const result = classifyMessageIntent(
      historyFrom(["está bem, obrigado"])
    );
    assert.equal(result.intent, "thanks_or_closing");
    assert.equal(shouldQueryProperties(result), false);
  });

  it('classifies "quais?" as ask_more_options with reshow', () => {
    const result = classifyMessageIntent(historyFrom(["quais?"]));
    assert.equal(result.intent, "ask_more_options");
    assert.equal(result.wantsReshow, true);
    assert.equal(shouldUseReshowBatch(result), true);
  });

  it('classifies "mostra outras opções" as ask_more_options with more', () => {
    const result = classifyMessageIntent(
      historyFrom(["mostra outras opções"])
    );
    assert.equal(result.intent, "ask_more_options");
    assert.equal(result.wantsMore, true);
    assert.equal(shouldRunFreshPropertyQuery(result), true);
    assert.equal(shouldUseReshowBatch(result), false);
  });

  it('classifies Milano apartment search as property_search', () => {
    const result = classifyMessageIntent(
      historyFrom(["Procuro apartamento em Milano até 600 mil"])
    );
    assert.equal(result.intent, "property_search");
    assert.equal(shouldQueryProperties(result), true);
    assert.equal(shouldRunFreshPropertyQuery(result), true);
  });

  it('classifies Milano house search as property_search', () => {
    const result = classifyMessageIntent(
      historyFrom(["Procuro moradia em Milano até 800 mil"])
    );
    assert.equal(result.intent, "property_search");
    assert.equal(shouldQueryProperties(result), true);
  });

  it('classifies visit request as visit_request', () => {
    const result = classifyMessageIntent(
      historyFrom(["Quero visitar amanhã às 15h"])
    );
    assert.equal(result.intent, "visit_request");
    assert.equal(shouldQueryProperties(result), false);
  });

  it("prioritizes ask_more_options over thanks when both signals appear", () => {
    const result = classifyMessageIntent(
      historyFrom(["obrigado, mostra outras opções"])
    );
    assert.equal(result.intent, "ask_more_options");
  });

  it('classifies "show options" as ask_more_options with fresh query', () => {
    const result = classifyMessageIntent(historyFrom(["show options"]));
    assert.equal(result.intent, "ask_more_options");
    assert.equal(result.wantsMore, true);
    assert.equal(shouldRunFreshPropertyQuery(result), true);
  });

  it('classifies Italian apartment search as property_search', () => {
    const result = classifyMessageIntent(
      historyFrom(["Cerco appartamento a Milano fino a 600 mil"])
    );
    assert.equal(result.intent, "property_search");
    assert.equal(shouldQueryProperties(result), true);
  });

  it('classifies "mostrami" as ask_more_options', () => {
    const result = classifyMessageIntent(historyFrom(["mostrami"]));
    assert.equal(result.intent, "ask_more_options");
    assert.equal(result.wantsMore, true);
  });

  it('classifies "sim" as accept_pending_offer when a pending city offer exists', () => {
    const result = classifyMessageIntent(historyFrom(["sim"]), leadWithPendingOffer());
    assert.equal(result.intent, "accept_pending_offer");
    assert.equal(shouldQueryProperties(result), true);
    assert.equal(shouldRunFreshPropertyQuery(result), false);
  });
});

describe("reply guardrails", () => {
  it("blocks exhausted-catalog lines without fresh query", () => {
    const blocked = violatesReplyGuardrails(
      "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso.",
      {
        intent: "unknown",
        freshQueryMade: false,
        propertiesSent: false,
        language: "pt",
      }
    );
    assert.equal(blocked, true);
  });

  it("blocks new-match teaser on thanks intent", () => {
    const blocked = violatesReplyGuardrails(
      "Se entrar algo novo aviso 👌",
      {
        intent: "thanks_or_closing",
        freshQueryMade: false,
        propertiesSent: false,
        language: "pt",
      }
    );
    assert.equal(blocked, true);
  });

  it("allows exhausted line when fresh query was made and properties sent", () => {
    const blocked = violatesReplyGuardrails(
      "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso.",
      {
        intent: "ask_more_options",
        freshQueryMade: true,
        propertiesSent: false,
        language: "pt",
      }
    );
    assert.equal(blocked, false);
  });
});
