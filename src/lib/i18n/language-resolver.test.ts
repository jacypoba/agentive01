import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { resolveConversationLanguageDebug } from "@/lib/i18n/resolve-language";
import type { Conversation } from "@/types/database";

const ORIGINAL_PATCH = process.env.STABILITY_PATCH_V1;

function resolve(
  message: string,
  leadPreferred: string | null,
  history: Conversation[] = []
) {
  return resolveConversationLanguageDebug({
    latestMessage: message,
    leadPreferred,
    conversationHistory: history,
  });
}

describe("Language strategy — messy real messages", () => {
  beforeEach(() => {
    process.env.STABILITY_PATCH_V1 = "true";
  });

  afterEach(() => {
    if (ORIGINAL_PATCH === undefined) {
      delete process.env.STABILITY_PATCH_V1;
    } else {
      process.env.STABILITY_PATCH_V1 = ORIGINAL_PATCH;
    }
  });

  describe("Italian", () => {
    it("full help + search message overrides stored pt", () => {
      const result = resolve(
        "salve, ho bisogno di aiuto, sto cercando una casa a Milano",
        "pt"
      );
      assert.equal(result.finalLanguage, "it");
      assert.equal(result.reason, "strong_current_message");
      assert.ok(result.confidence !== "low");
    });

    it("casual search with budget shorthand", () => {
      const result = resolve("ciao cerco casa milano budget 800k", "pt");
      assert.equal(result.finalLanguage, "it");
    });

    it("neighborhood request", () => {
      const result = resolve("mi serve un appartamento zona navigli", "pt");
      assert.equal(result.finalLanguage, "it");
    });
  });

  describe("Portuguese overrides stale stored language", () => {
    const ptRomaCases = [
      "olá, estou procurando uma casa em Roma",
      "ola estou procurando uma casa em Roma",
      "estou procurando uma casa em Roma",
      "estou à procura de uma casa em Roma",
      "procuro uma casa em Roma",
    ];

    for (const message of ptRomaCases) {
      it(`stored=it, "${message}" → pt`, () => {
        const result = resolve(message, "it");
        assert.equal(result.finalLanguage, "pt");
        assert.ok(
          result.reason === "clear_current_message" ||
            result.reason === "strong_current_message"
        );
      });
    }

    it('stored=it, "ok" → it', () => {
      const result = resolve("ok", "it");
      assert.equal(result.finalLanguage, "it");
      assert.equal(result.reason, "sticky_ambiguous");
    });

    it('stored=it, "casa Roma" → it', () => {
      const result = resolve("casa Roma", "it");
      assert.equal(result.finalLanguage, "it");
      assert.ok(
        result.reason === "sticky_ambiguous" ||
          result.reason === "uncertain_keep_stored"
      );
    });

    it('stored=it, "Roma" → it', () => {
      const result = resolve("Roma", "it");
      assert.equal(result.finalLanguage, "it");
      assert.ok(
        result.reason === "sticky_ambiguous" ||
          result.reason === "uncertain_keep_stored"
      );
    });
  });

  describe("Cross-language switch from stored", () => {
    it("stored=pt, Italian clear message switches to it", () => {
      const result = resolve(
        "salve, sto cercando una casa a Milano",
        "pt"
      );
      assert.equal(result.finalLanguage, "it");
      assert.ok(
        result.reason === "clear_current_message" ||
          result.reason === "strong_current_message"
      );
    });

    it("stored=fr, English clear message switches to en", () => {
      const result = resolve("hi, I'm looking for a house in London", "fr");
      assert.equal(result.finalLanguage, "en");
      assert.ok(
        result.reason === "clear_current_message" ||
          result.reason === "strong_current_message"
      );
    });
  });

  describe("Portuguese", () => {
    it("help + search in Milano", () => {
      const result = resolve(
        "olá preciso de ajuda, procuro uma casa em Milano",
        "it"
      );
      assert.equal(result.finalLanguage, "pt");
    });

    it("buy intent with budget", () => {
      const result = resolve("quero comprar apartamento até 800 mil", "it");
      assert.equal(result.finalLanguage, "pt");
    });
  });

  describe("French", () => {
    it("Paris house search", () => {
      const result = resolve("bonjour je cherche une maison à paris", null);
      assert.equal(result.finalLanguage, "fr");
    });

    it("informal Milan apartment request", () => {
      const result = resolve("je voudrais un appart à milan si possible", "it");
      assert.equal(result.finalLanguage, "fr");
    });
  });

  describe("English", () => {
    it("house search in Milan", () => {
      const result = resolve("hi, looking for a house in Milan", "pt");
      assert.equal(result.finalLanguage, "en");
    });

    it("help finding near Navigli", () => {
      const result = resolve("need help finding an apartment near Navigli", "pt");
      assert.equal(result.finalLanguage, "en");
    });
  });

  describe("Spanish", () => {
    it("house search in Milan", () => {
      const result = resolve("hola busco una casa en milán", "pt");
      assert.equal(result.finalLanguage, "es");
    });

    it("buy with budget", () => {
      const result = resolve("quiero comprar un apartamento hasta 800 mil", "pt");
      assert.equal(result.finalLanguage, "es");
    });
  });

  describe("Ambiguous", () => {
    it('stored=it, "ok" → it', () => {
      const result = resolve("ok", "it");
      assert.equal(result.finalLanguage, "it");
      assert.equal(result.reason, "sticky_ambiguous");
    });

    it('stored=pt, "ok" → pt', () => {
      const result = resolve("ok", "pt");
      assert.equal(result.finalLanguage, "pt");
      assert.equal(result.reason, "sticky_ambiguous");
    });

    it('stored=fr, "merci" → fr', () => {
      const result = resolve("merci", "fr");
      assert.equal(result.finalLanguage, "fr");
      assert.equal(result.reason, "sticky_ambiguous");
    });

    it('stored=null, "ok" → pt', () => {
      const result = resolve("ok", null);
      assert.equal(result.finalLanguage, "pt");
      assert.equal(result.reason, "sticky_ambiguous");
    });
  });

  describe("Mixed", () => {
    it('"ciao, procuro casa a Milano" prefers dominant Portuguese', () => {
      const result = resolve("ciao, procuro casa a Milano", "en");
      assert.equal(result.finalLanguage, "pt");
    });

    it('"hello, cerco casa a Milano" prefers dominant Italian', () => {
      const result = resolve("hello, cerco casa a Milano", "pt");
      assert.equal(result.finalLanguage, "it");
    });
  });

  describe("Weak tokens only", () => {
    it('stored=pt, "casa Milano" stays pt', () => {
      const result = resolve("casa Milano", "pt");
      assert.equal(result.finalLanguage, "pt");
      assert.equal(result.reason, "sticky_ambiguous");
    });
  });

  describe("Explicit request priority", () => {
    it("explicit request wins over detected language", () => {
      const result = resolve(
        "salve, ho bisogno di aiuto — responde em português",
        "it"
      );
      assert.equal(result.finalLanguage, "pt");
      assert.equal(result.reason, "explicit_request");
    });
  });

  it("returns evidence for debugging", () => {
    const result = resolve(
      "salve, ho bisogno di aiuto, sto cercando una casa a Milano",
      "pt"
    );
    assert.ok(result.evidence.it.length > 0);
    assert.ok(result.scores.it > result.scores.pt);
  });
});
