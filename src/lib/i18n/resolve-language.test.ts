import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { resolveConversationLanguageDebug } from "@/lib/i18n/resolve-language";

const ORIGINAL_PATCH = process.env.STABILITY_PATCH_V1;

function resolve(message: string, leadPreferred: string | null) {
  return resolveConversationLanguageDebug({
    latestMessage: message,
    leadPreferred,
  });
}

describe("sticky language policy (STABILITY_PATCH_V1)", () => {
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

  it('stored=it, "Vorrei una casa a Milano" → it, reason=sticky', () => {
    const result = resolve("Vorrei una casa a Milano", "it");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "sticky");
  });

  it('stored=pt, "Apartment in Milan 800k" → pt, reason=sticky', () => {
    const result = resolve("Apartment in Milan 800k", "pt");
    assert.equal(result.finalLanguage, "pt");
    assert.equal(result.reason, "sticky");
  });

  it('stored=pt, "Cerco appartamento a Milano fino a 600 mil" → it, reason=confident_switch', () => {
    const result = resolve("Cerco appartamento a Milano fino a 600 mil", "pt");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "confident_switch");
  });

  it('stored=null, "Vorrei comprare una casa a Firenze" → it, reason=first_message_language', () => {
    const result = resolve("Vorrei comprare una casa a Firenze", null);
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "first_message_language");
  });

  it('stored=it, "ok" → it, reason=ambiguous', () => {
    const result = resolve("ok", "it");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "ambiguous");
  });

  it('stored=it, "Procuro apartamento em Milano até 800 mil euros" → pt, reason=confident_switch', () => {
    const result = resolve(
      "Procuro apartamento em Milano até 800 mil euros",
      "it"
    );
    assert.equal(result.finalLanguage, "pt");
    assert.equal(result.reason, "confident_switch");
  });

  it("honours explicit language switch requests", () => {
    const result = resolve("Can you reply in English please?", "pt");
    assert.equal(result.finalLanguage, "en");
    assert.equal(result.reason, "explicit");
  });

  it("honours rispondi in italiano", () => {
    const result = resolve("Per favore rispondi in italiano", "pt");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "explicit");
  });

  it('greeting "ciao" keeps stored language', () => {
    const result = resolve("ciao", "it");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "ambiguous");
  });

  it("exports strongSignalCount on detection", () => {
    const result = resolve("Cerco appartamento a Milano fino a 600 mil", "pt");
    assert.ok(result.strongSignalCount.it >= 2);
    assert.equal(result.reason, "confident_switch");
  });
});

describe("Language V3 first message detection (STABILITY_PATCH_V1)", () => {
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

  it('stored=null, "Je cherche une maison à Paris" → fr', () => {
    const result = resolve("Je cherche une maison à Paris", null);
    assert.equal(result.finalLanguage, "fr");
    assert.equal(result.reason, "first_message_language");
  });

  it('stored=null, "I am looking for a house in Milan" → en', () => {
    const result = resolve("I am looking for a house in Milan", null);
    assert.equal(result.finalLanguage, "en");
    assert.equal(result.reason, "first_message_language");
  });

  it('stored=null, "Busco un apartamento en Madrid" → es', () => {
    const result = resolve("Busco un apartamento en Madrid", null);
    assert.equal(result.finalLanguage, "es");
    assert.equal(result.reason, "first_message_language");
  });

  it('stored=null, "Procuro uma moradia em Lisboa" → pt', () => {
    const result = resolve("Procuro uma moradia em Lisboa", null);
    assert.equal(result.finalLanguage, "pt");
    assert.equal(result.reason, "first_message_language");
  });

  it("does not override stored language with first-message patterns", () => {
    const result = resolve("Vorrei comprare una casa a Firenze", "pt");
    assert.equal(result.finalLanguage, "pt");
    assert.equal(result.reason, "sticky");
  });

  it("explicit language request wins over first-message patterns", () => {
    const result = resolve(
      "Vorrei comprare una casa a Firenze — rispondi in italiano",
      null
    );
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "explicit");
  });
});

describe("legacy language policy (patch off)", () => {
  beforeEach(() => {
    process.env.STABILITY_PATCH_V1 = "false";
  });

  afterEach(() => {
    if (ORIGINAL_PATCH === undefined) {
      delete process.env.STABILITY_PATCH_V1;
    } else {
      process.env.STABILITY_PATCH_V1 = ORIGINAL_PATCH;
    }
  });

  it("uses score >= 2 weak path when patch is disabled", () => {
    const result = resolveConversationLanguageDebug({
      latestMessage: "Quero marcar visita para segunda-feira de manhã",
      leadPreferred: "es",
    });
    assert.equal(result.finalLanguage, "pt");
    assert.equal(result.reason, "confident_switch");
  });
});
