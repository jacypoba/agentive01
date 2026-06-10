import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNormalizedPropertySearch,
  citiesMatch,
  extractCityFromMessage,
  extractPropertyTypeFromMessage,
  normalizeCity,
  normalizePropertyType,
  normalizeSearchCriteria,
  parseNormalizedBudget,
  propertyTypesMatch,
} from "@/lib/properties/normalize-search";

describe("normalizeCity", () => {
  it("maps Milan variants to Milano", () => {
    assert.equal(normalizeCity("Milan"), "Milano");
    assert.equal(normalizeCity("Milão"), "Milano");
  });
});

describe("extractCityFromMessage", () => {
  it('extracts Milano from "a villa in Milan" without false positive', () => {
    assert.equal(
      extractCityFromMessage("Looking for a villa in Milan up to 800k"),
      "Milano"
    );
  });
});

describe("extractPropertyTypeFromMessage", () => {
  it("extracts moradia from villa", () => {
    assert.equal(
      extractPropertyTypeFromMessage("Looking for a villa in Milan"),
      "moradia"
    );
  });

  it("extracts apartamento from condo", () => {
    assert.equal(extractPropertyTypeFromMessage("Need a condo in Milan"), "apartamento");
  });
});

describe("normalizePropertyType", () => {
  it("maps multilingual house terms to moradia", () => {
    assert.equal(normalizePropertyType("villa"), "moradia");
    assert.equal(normalizePropertyType("house"), "moradia");
    assert.equal(normalizePropertyType("townhouse"), "moradia");
    assert.equal(normalizePropertyType("casa"), "moradia");
  });

  it("maps apartment terms to apartamento", () => {
    assert.equal(normalizePropertyType("apartment"), "apartamento");
    assert.equal(normalizePropertyType("condo"), "apartamento");
    assert.equal(normalizePropertyType("flat"), "apartamento");
  });
});

describe("parseNormalizedBudget", () => {
  it("parses multilingual budget formats", () => {
    assert.equal(parseNormalizedBudget("800k"), 800_000);
    assert.equal(parseNormalizedBudget("800 K"), 800_000);
    assert.equal(parseNormalizedBudget("800 thousand"), 800_000);
    assert.equal(parseNormalizedBudget("800 mil"), 800_000);
    assert.equal(parseNormalizedBudget("800 mila"), 800_000);
    assert.equal(parseNormalizedBudget("800.000"), 800_000);
    assert.equal(parseNormalizedBudget("800000"), 800_000);
  });
});

describe("buildNormalizedPropertySearch", () => {
  it("builds strict criteria for English villa search in Milan", () => {
    const result = buildNormalizedPropertySearch({
      rawUserInput: "Looking for a villa in Milan up to 800 thousand",
    });

    assert.equal(result.normalizedCity, "Milano");
    assert.equal(result.normalizedPropertyType, "moradia");
    assert.equal(result.normalizedBudget, 800_000);
    assert.deepEqual(result.criteria, {
      city: "Milano",
      propertyType: "moradia",
      maxBudget: 800_000,
      neighborhood: undefined,
    });
  });
});

describe("normalizeSearchCriteria", () => {
  it("always normalizes query values", () => {
    assert.deepEqual(
      normalizeSearchCriteria({
        city: "Milan",
        propertyType: "villa",
        maxBudget: 800_000,
      }),
      {
        city: "Milano",
        propertyType: "moradia",
        maxBudget: 800_000,
        neighborhood: undefined,
      }
    );
  });
});

describe("property matching helpers", () => {
  it("matches Milan and Milano cities", () => {
    assert.equal(citiesMatch("Milan", "Milano"), true);
    assert.equal(citiesMatch("Milão", "Milano"), true);
  });

  it("matches house and moradia types", () => {
    assert.equal(propertyTypesMatch("house", "moradia"), true);
    assert.equal(propertyTypesMatch("villa", "moradia"), true);
    assert.equal(propertyTypesMatch("apartment", "apartamento"), true);
  });
});
