import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectFirstMessageLanguage } from "@/lib/i18n/first-message-language";

describe("detectFirstMessageLanguage", () => {
  it("detects Italian property search opener", () => {
    assert.equal(
      detectFirstMessageLanguage("Vorrei comprare una casa a Firenze"),
      "it"
    );
  });

  it("detects French property search opener", () => {
    assert.equal(
      detectFirstMessageLanguage("Je cherche une maison à Paris"),
      "fr"
    );
  });

  it("detects English property search opener", () => {
    assert.equal(
      detectFirstMessageLanguage("I am looking for a house in Milan"),
      "en"
    );
  });

  it("detects Spanish property search opener", () => {
    assert.equal(
      detectFirstMessageLanguage("Busco un apartamento en Madrid"),
      "es"
    );
  });

  it("detects Portuguese property search opener", () => {
    assert.equal(
      detectFirstMessageLanguage("Procuro uma moradia em Lisboa"),
      "pt"
    );
  });

  it("returns null for ambiguous shared words only", () => {
    assert.equal(detectFirstMessageLanguage("casa"), null);
  });
});
