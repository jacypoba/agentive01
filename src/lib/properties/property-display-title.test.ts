import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPropertyCard,
  formatPropertyDisplayTitle,
} from "@/lib/properties/property-cards";
import { buildPlainPropertySummary } from "@/lib/properties/send-whatsapp";
import type { Property } from "@/types/database";

function property(partial: Partial<Property> & Pick<Property, "title">): Property {
  return {
    id: partial.id ?? "prop-title-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    city: partial.city ?? "Milano",
    neighborhood: partial.neighborhood ?? "Navigli",
    property_type: partial.property_type ?? "moradia",
    price: partial.price ?? 650_000,
    bedrooms: partial.bedrooms ?? 2,
    bathrooms: partial.bathrooms ?? 2,
    description: partial.description ?? null,
    image_url: partial.image_url ?? null,
    listing_url: partial.listing_url ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
    ...partial,
  };
}

describe("formatPropertyDisplayTitle", () => {
  it("FR: Moradia com jardim → Maison avec jardin", () => {
    const listing = property({ title: "Moradia com jardim" });
    assert.equal(formatPropertyDisplayTitle(listing, "fr"), "Maison avec jardin");
  });

  it("IT: Moradia com jardim → Casa con giardino", () => {
    const listing = property({ title: "Moradia com jardim" });
    assert.equal(formatPropertyDisplayTitle(listing, "it"), "Casa con giardino");
  });

  it("EN: Moradia com jardim → House with garden", () => {
    const listing = property({ title: "Moradia com jardim" });
    assert.equal(formatPropertyDisplayTitle(listing, "en"), "House with garden");
  });

  it("ES: Moradia com jardim → Casa con jardín", () => {
    const listing = property({ title: "Moradia com jardim" });
    assert.equal(formatPropertyDisplayTitle(listing, "es"), "Casa con jardín");
  });

  it("PT leaves title unchanged", () => {
    const listing = property({ title: "Moradia com jardim" });
    assert.equal(formatPropertyDisplayTitle(listing, "pt"), "Moradia com jardim");
  });

  it("unknown custom title remains unchanged", () => {
    const listing = property({ title: "Villa Lux Navigli" });
    assert.equal(formatPropertyDisplayTitle(listing, "fr"), "Villa Lux Navigli");
  });

  it("does not mutate property.title", () => {
    const listing = property({ title: "Moradia com jardim" });
    const original = listing.title;
    formatPropertyDisplayTitle(listing, "fr");
    assert.equal(listing.title, original);
  });
});

describe("formatPropertyDisplayTitle in outbound card paths", () => {
  it("formatPropertyCard uses localized title for FR", () => {
    const listing = property({ title: "Moradia com jardim" });
    const card = formatPropertyCard(listing, "fr");
    assert.match(card, /^🏡 Maison avec jardin/);
    assert.doesNotMatch(card, /Moradia com jardim/);
  });

  it("buildPlainPropertySummary uses localized title for FR", () => {
    const listing = property({
      title: "Moradia com jardim",
      listing_url: "https://agency.example/listing-1",
    });
    const summary = buildPlainPropertySummary(listing, "fr");
    assert.match(summary, /^Maison avec jardin/);
    assert.doesNotMatch(summary, /Moradia com jardim/);
  });
});
