import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalEvolutionSendTextPayload,
  buildSendTextPayloadVariants,
  getProductionSendTextFormatOrder,
  isEvolutionMissingTextError,
  normalizeEvolutionSendTextPayload,
  selectSendTextPayloadVariant,
} from "@/lib/evolution/send-text-payload";

describe("Evolution sendText payload", () => {
  it("builds canonical SendTextDto with top-level text", () => {
    const payload = buildCanonicalEvolutionSendTextPayload({
      number: "393471234567",
      text: "Hello from Agentive01",
    });

    assert.deepEqual(payload, {
      number: "393471234567",
      text: "Hello from Agentive01",
    });
  });

  it("normalizes legacy textMessage payloads to include root text", () => {
    const payload = normalizeEvolutionSendTextPayload(
      {
        number: "393471234567",
        textMessage: { text: "Reply text" },
      },
      "Reply text"
    );

    assert.equal(payload.number, "393471234567");
    assert.equal(payload.text, "Reply text");
    assert.equal("textMessage" in payload, false);
  });

  it("selects digits payload with required text field", () => {
    const selected = selectSendTextPayloadVariant({
      phoneDigits: "393471234567",
      text: "Test reply",
      remoteJid: "393471234567@s.whatsapp.net",
      format: "digits",
    });

    assert.equal(selected.format, "digits");
    assert.equal(selected.payload.text, "Test reply");
    assert.equal(selected.payload.number, "393471234567");
  });

  it("defaults production order to SendTextDto-compatible formats only", () => {
    const order = getProductionSendTextFormatOrder("393471234567@s.whatsapp.net");
    assert.deepEqual(order, ["digits", "jid"]);
  });

  it("detects Evolution missing text validation errors", () => {
    assert.equal(
      isEvolutionMissingTextError('instance requires property "text"'),
      true
    );
  });

  it("includes root text on legacy textMessage diagnostic variants", () => {
    const variants = buildSendTextPayloadVariants({
      phoneDigits: "393471234567",
      text: "Hello",
      remoteJid: "393471234567@s.whatsapp.net",
    });

    const legacy = variants.find((variant) => variant.format === "textMessage");
    assert.ok(legacy);
    assert.equal(legacy.payload.text, "Hello");
    assert.deepEqual(legacy.payload.textMessage, { text: "Hello" });
  });
});
