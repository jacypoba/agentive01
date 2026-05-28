import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  citiesMatch,
  normalizeCity,
  normalizePropertyType,
  parseNormalizedBudget,
  propertyTypesMatch,
} from "@/lib/properties/normalize-search";

describe("normalizeCity", () => {
  it("maps Milan variants to Milano", () => {
    assert.equal(normalizeCity("Milan"), "Milano");
    assert.equal(normalizeCity("Milão"), "Milano");
  });
});

describe("normalizePropertyType", () => {
  it("maps multilingual house terms to moradia", () => {
    assert.equal(normalizePropertyType("villa"), "moradia");
    assert.equal(normalizePropertyType("house"), "moradia");
    assert.equal(normalizePropertyType("casa"), "moradia");
  });

  it("maps apartment terms to apartamento", () => {
    assert.equal(normalizePropertyType("apartment"), "apartamento");
    assert.equal(normalizePropertyType("appartamento"), "apartamento");
    assert.equal(normalizePropertyType("flat"), "apartamento");
  });
});

describe("parseNormalizedBudget", () => {
  it("parses multilingual budget formats", () => {
    assert.equal(parseNormalizedBudget("800k"), 800_000);
    assert.equal(parseNormalizedBudget("800 mil"), 800_000);
    assert.equal(parseNormalizedBudget("800 mila"), 800_000);
    assert.equal(parseNormalizedBudget("800 mila euro"), 800_000);
    assert.equal(parseNormalizedBudget("800.000"), 800_000);
    assert.equal(parseNormalizedBudget("800000"), 800_000);
  });
});

describe("property matching helpers", () => {
  it("matches Milan and Milano cities", () => {
    assert.equal(citiesMatch("Milan", "Milano"), true);
    assert.equal(citiesMatch("Milão", "Milano"), true);
  });

  it("matches house and moradia types", () => {
    assert.equal(propertyTypesMatch("house", "moradia"), true);
    assert.equal(propertyTypesMatch("apartment", "apartamento"), true);
  });
});
