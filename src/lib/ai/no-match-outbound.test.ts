import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeAiReply } from "@/lib/ai/dedupe-reply";
import { sanitizeGuardedReply } from "@/lib/ai/guardrails";
import { pickNoMatchIntroReply } from "@/lib/ai/no-match-reply";
import { NO_MATCH_LINES, getNoMatchLine } from "@/lib/i18n/messages";
import type { Conversation } from "@/types/database";

const LEAD_ID = "lead-no-match-test";
const LANGUAGE = "pt";

function aiMessage(text: string): Conversation {
  return {
    id: `ai-${text.slice(0, 12)}`,
    lead_id: LEAD_ID,
    message: text,
    sender: "ai",
    created_at: new Date().toISOString(),
  };
}

function clientMessage(text: string): Conversation {
  return {
    id: `client-${text.slice(0, 12)}`,
    lead_id: LEAD_ID,
    message: text,
    sender: "client",
    created_at: new Date().toISOString(),
  };
}

const propertySearchGuard = {
  intent: "property_search" as const,
  freshQueryMade: true,
  propertiesSent: false,
  language: LANGUAGE,
};

/** Mirrors appendUniqueTextReply text path (guard + dedupe, no DB). */
function wouldAppendTextOutbound(
  text: string,
  history: Conversation[]
): boolean {
  const sanitized = sanitizeGuardedReply(text, history, propertySearchGuard);
  if (!sanitized) {
    return false;
  }
  return dedupeAiReply(sanitized, history).trim().length > 0;
}

function buildOutboundTextMessages(
  history: Conversation[]
): { texts: string[]; reply: string } {
  const reply = pickNoMatchIntroReply(LANGUAGE, history, LEAD_ID);
  const outbound = wouldAppendTextOutbound(reply, history);
  return {
    reply,
    texts: outbound ? [reply] : [],
  };
}

describe("pickNoMatchIntroReply / no-match outbound", () => {
  it("first no-match turn: history empty → one text outbound", () => {
    const history: Conversation[] = [
      clientMessage("Procuro apartamento em Milano até 800 mil euros"),
    ];
    const { texts, reply } = buildOutboundTextMessages(history);

    assert.equal(texts.length, 1);
    assert.ok(NO_MATCH_LINES.pt.includes(reply));
    assert.equal(wouldAppendTextOutbound(reply, history), true);
  });

  it("repeated no-match turn: prefers a different variant when one was already sent", () => {
    const first = pickNoMatchIntroReply(LANGUAGE, [], LEAD_ID);
    const history: Conversation[] = [
      clientMessage("Procuro apartamento em Milano até 800 mil euros"),
      aiMessage(first),
      clientMessage("Procuro outra vez em Milano até 800 mil"),
    ];

    const { texts, reply } = buildOutboundTextMessages(history);

    assert.equal(texts.length, 1);
    assert.notEqual(reply, first);
    assert.ok(NO_MATCH_LINES.pt.includes(reply));
  });

  it("never returns empty outbound for property_search 0-match replies (3 turns)", () => {
    let history: Conversation[] = [
      clientMessage("Procuro apartamento em Milano até 800 mil euros"),
    ];

    for (let turn = 0; turn < 3; turn += 1) {
      const { texts, reply } = buildOutboundTextMessages(history);
      assert.ok(reply.trim().length > 0, `turn ${turn + 1} reply empty`);
      assert.equal(texts.length, 1, `turn ${turn + 1} outbound empty`);

      history = [
        ...history,
        aiMessage(reply),
        clientMessage(`Nova pesquisa Milano turno ${turn + 2}`),
      ];
    }
  });

  it("generic dedupe still blocks exact duplicate non-no-match AI replies", () => {
    const generic = "Perfeito 👌 Fico por aqui então. Se precisar, é só chamar.";
    const history: Conversation[] = [aiMessage(generic)];

    assert.equal(dedupeAiReply(generic, history), "");
  });
});

describe("deterministic getNoMatchLine regression", () => {
  it("old deterministic pick would block repeat; history-aware pick does not", () => {
    const deterministic = getNoMatchLine(LANGUAGE, `${LEAD_ID}:no-match`);
    const history: Conversation[] = [
      clientMessage("Milano 800k"),
      aiMessage(deterministic),
      clientMessage("Milano 800k outra vez"),
    ];

    const repeatDeterministic = getNoMatchLine(LANGUAGE, `${LEAD_ID}:no-match`);
    assert.equal(repeatDeterministic, deterministic);
    assert.equal(wouldAppendTextOutbound(repeatDeterministic, history), false);

    const historyAware = pickNoMatchIntroReply(LANGUAGE, history, LEAD_ID);
    assert.notEqual(historyAware, deterministic);
    assert.equal(wouldAppendTextOutbound(historyAware, history), true);
  });
});
