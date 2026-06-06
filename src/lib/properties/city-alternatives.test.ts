import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickNoMatchIntroReply } from "@/lib/ai/no-match-reply";
import {
  buildCityAlternativeFallbackText,
  buildCityAlternativeSummary,
  filterAlternativeProperties,
} from "@/lib/properties/city-alternatives";
import type { Property } from "@/types/database";

function property(partial: Partial<Property> & Pick<Property, "city">): Property {
  return {
    id: partial.id ?? "prop-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    title: partial.title ?? "Listing",
    city: partial.city,
    neighborhood: partial.neighborhood ?? null,
    property_type: partial.property_type ?? "moradia",
    price: partial.price ?? 500_000,
    bedrooms: partial.bedrooms ?? 3,
    bathrooms: partial.bathrooms ?? 2,
    description: partial.description ?? null,
    image_url: partial.image_url ?? null,
    listing_url: partial.listing_url ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

const milanoNavigli = property({
  id: "milano-1",
  city: "Milano",
  neighborhood: "Navigli",
  property_type: "moradia",
  price: 650_000,
});

const milanoCentro = property({
  id: "milano-2",
  city: "Milano",
  neighborhood: "Centro",
  property_type: "apartamento",
  price: 420_000,
});

describe("buildCityAlternativeSummary", () => {
  it("returns Milano/Navigli when requested Firenze has no inventory", () => {
    const summary = buildCityAlternativeSummary(
      [milanoNavigli, milanoCentro],
      { city: "Firenze", propertyType: "moradia" }
    );

    assert.ok(summary);
    assert.equal(summary.requestedCity, "Firenze");
    assert.deepEqual(summary.availableCities, ["Milano"]);
    assert.ok(summary.availableAreas.includes("Navigli"));
    assert.equal(summary.primaryCity, "Milano");
    assert.deepEqual(summary.primaryAreas, ["Navigli"]);
  });

  it("returns null when no alternative cities exist", () => {
    const summary = buildCityAlternativeSummary(
      [property({ id: "f1", city: "Firenze", property_type: "moradia" })],
      { city: "Firenze", propertyType: "moradia" }
    );

    assert.equal(summary, null);
  });

  it("returns null when requested city is missing from criteria", () => {
    const summary = buildCityAlternativeSummary([milanoNavigli], {
      city: "",
      propertyType: "moradia",
    });

    assert.equal(summary, null);
  });
});

describe("buildCityAlternativeFallbackText", () => {
  it("produces Portuguese fallback mentioning Milano and Navigli", () => {
    const summary = buildCityAlternativeSummary(
      [milanoNavigli],
      { city: "Firenze", propertyType: "moradia" }
    );
    assert.ok(summary);

    const text = buildCityAlternativeFallbackText("pt", summary);
    assert.match(text, /Firenze/i);
    assert.match(text, /Milano/i);
    assert.match(text, /Navigli/i);
    assert.match(text, /\?$/);
  });

  it("produces Italian fallback for Firenze with Milano alternatives", () => {
    const summary = buildCityAlternativeSummary(
      [milanoNavigli],
      { city: "Firenze", propertyType: "moradia" }
    );
    assert.ok(summary);

    const text = buildCityAlternativeFallbackText("it", summary);
    assert.match(text, /Firenze/i);
    assert.match(text, /Milano/i);
    assert.match(text, /Navigli/i);
    assert.match(text, /\?$/);
  });
});

describe("no-match vs city fallback selection", () => {
  it("uses generic no-match when no alternative inventory exists", () => {
    const summary = buildCityAlternativeSummary([], {
      city: "Firenze",
      propertyType: "moradia",
    });
    assert.equal(summary, null);

    const generic = pickNoMatchIntroReply("pt", [], "lead-1");
    assert.match(generic, /encaixa|perfil|encontrei/i);
  });

  it("city fallback text differs from generic no-match", () => {
    const summary = buildCityAlternativeSummary([milanoNavigli], {
      city: "Firenze",
      propertyType: "moradia",
    });
    assert.ok(summary);

    const fallback = buildCityAlternativeFallbackText("pt", summary);
    const generic = pickNoMatchIntroReply("pt", [], "lead-1");
    assert.notEqual(fallback, generic);
  });
});

describe("filterAlternativeProperties", () => {
  it("respects budget and type while excluding requested city", () => {
    const filtered = filterAlternativeProperties(
      [milanoNavigli, milanoCentro],
      { city: "Firenze", propertyType: "moradia", maxBudget: 700_000 }
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "milano-1");
  });
});
