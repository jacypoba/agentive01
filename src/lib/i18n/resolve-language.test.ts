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

  it('stored=it, "Vorrei una casa a Milano" → it', () => {
    const result = resolve("Vorrei una casa a Milano", "it");
    assert.equal(result.finalLanguage, "it");
  });

  it('stored=pt, "Apartment in Milan 800k" → pt', () => {
    const result = resolve("Apartment in Milan 800k", "pt");
    assert.equal(result.finalLanguage, "pt");
    assert.equal(result.reason, "uncertain_keep_stored");
  });

  it('stored=pt, "Cerco appartamento a Milano fino a 600 mil" → it', () => {
    const result = resolve("Cerco appartamento a Milano fino a 600 mil", "pt");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "strong_current_message");
  });

  it('stored=null, "Vorrei comprare una casa a Firenze" → it', () => {
    const result = resolve("Vorrei comprare una casa a Firenze", null);
    assert.equal(result.finalLanguage, "it");
  });

  it('stored=it, "ok" → it', () => {
    const result = resolve("ok", "it");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "sticky_ambiguous");
  });

  it('stored=it, "Procuro apartamento em Milano até 800 mil euros" → pt', () => {
    const result = resolve(
      "Procuro apartamento em Milano até 800 mil euros",
      "it"
    );
    assert.equal(result.finalLanguage, "pt");
  });

  it("honours explicit language switch requests", () => {
    const result = resolve("Can you reply in English please?", "pt");
    assert.equal(result.finalLanguage, "en");
    assert.equal(result.reason, "explicit_request");
  });

  it("honours rispondi in italiano", () => {
    const result = resolve("Per favore rispondi in italiano", "pt");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "explicit_request");
  });

  it('greeting "ciao" keeps stored language', () => {
    const result = resolve("ciao", "it");
    assert.equal(result.finalLanguage, "it");
    assert.equal(result.reason, "sticky_ambiguous");
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
