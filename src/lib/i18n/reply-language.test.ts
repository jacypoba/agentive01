import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectLanguageFromText } from "@/lib/i18n/detect-language";
import { enforceReplyLanguage } from "@/lib/i18n/language-purity";
import { resolveConversationLanguage } from "@/lib/i18n/resolve-language";
import {
  buildStrictReplyLanguageDirective,
  isGenericLowEffortReply,
  validateReplyLanguage,
} from "@/lib/i18n/reply-language";

describe("inbound language → outbound language", () => {
  it("detects Portuguese from a budget inquiry in Portuguese", () => {
    const message = "Podem ajudar com imóveis até 800 mil euros?";
    assert.equal(detectLanguageFromText(message), "pt");
    assert.equal(
      resolveConversationLanguage({
        latestMessage: message,
        leadPreferred: "en",
      }),
      "pt"
    );
  });

  it("detects Italian input", () => {
    const message = "Cerco appartamento a Milano fino a 600 mil";
    assert.equal(detectLanguageFromText(message), "it");
    assert.equal(
      resolveConversationLanguage({ latestMessage: message, leadPreferred: "en" }),
      "it"
    );
  });

  it("detects English input", () => {
    const message = "Thanks, looking for an apartment in Milan up to 600k";
    assert.equal(detectLanguageFromText(message), "en");
    assert.equal(
      resolveConversationLanguage({ latestMessage: message, leadPreferred: "pt" }),
      "en"
    );
  });

  it("detects Spanish input", () => {
    const message = "Busco apartamento en Milano hasta 600 mil";
    assert.equal(detectLanguageFromText(message), "es");
    assert.equal(
      resolveConversationLanguage({ latestMessage: message, leadPreferred: "en" }),
      "es"
    );
  });
});

describe("validateReplyLanguage", () => {
  it("rejects English 'Got it on the budget' when Portuguese is expected", () => {
    const result = validateReplyLanguage(
      "Got it on the budget — I'll check options.",
      "pt"
    );
    assert.equal(result.valid, false);
    assert.ok(result.reason === "banned_opener" || result.reason === "english_leak");
  });

  it("rejects generic low-effort openers", () => {
    assert.equal(isGenericLowEffortReply("Got it"), true);
    assert.equal(isGenericLowEffortReply("Okay"), true);
    assert.equal(isGenericLowEffortReply("Boa"), true);
    assert.equal(isGenericLowEffortReply("Boa —"), true);
  });

  it("accepts a concrete Portuguese consultant reply", () => {
    const result = validateReplyLanguage(
      "Claro — vejo opções até 800 mil. Prefere comprar ou arrendar?",
      "pt"
    );
    assert.equal(result.valid, true);
  });

  it("enforceReplyLanguage replaces invalid English with Portuguese fallback", () => {
    const enforced = enforceReplyLanguage(
      "Got it on the budget — I'll check.",
      "pt"
    );
    assert.equal(enforced.adjusted, true);
    assert.match(enforced.text, /Claro|vejo|zona|perfil/i);
    assert.doesNotMatch(enforced.text, /^got it\b/i);
  });
});

describe("buildStrictReplyLanguageDirective", () => {
  it("states detected language overrides workspace preferred languages", () => {
    const directive = buildStrictReplyLanguageDirective(
      "pt",
      "Podem ajudar com imóveis até 800 mil euros?"
    );
    assert.match(directive, /HIGHEST PRIORITY/i);
    assert.match(directive, /Portuguese/i);
    assert.match(directive, /Forbidden openers/i);
  });
});
