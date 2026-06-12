import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFirstRecommendationSingleIntros,
  LISTING_LABELS,
  PROPERTY_CARD_LABELS,
} from "@/lib/i18n/messages";
import { buildRecommendationIntroText } from "@/lib/properties/recommendation-intros";
import { formatPropertyWhatsAppPackageText } from "@/lib/properties/property-cards";
import type { Conversation, Property } from "@/types/database";

function clientMessage(text: string): Conversation {
  return {
    id: "1",
    lead_id: "lead-fr",
    workspace_id: "ws-1",
    message: text,
    sender: "client",
    created_at: new Date().toISOString(),
  };
}

function sampleProperty(): Property {
  return {
    id: "prop-fr-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    title: "Appartement Test",
    city: "Paris",
    neighborhood: "Marais",
    property_type: "apartamento",
    price: 750_000,
    bedrooms: 2,
    bathrooms: 2,
    description: null,
    image_url: null,
    listing_url: "https://agency.example/paris-1",
    created_at: new Date().toISOString(),
  };
}

describe("French property outbound copy", () => {
  it("single recommendation intro variants are French, not English", () => {
    const intros = getFirstRecommendationSingleIntros("fr");

    assert.ok(intros.length > 0);
    for (const intro of intros) {
      assert.doesNotMatch(intro, /good fit|View details|bedrooms?/i);
      assert.match(intro, /option|intéress|recherche|correspond/i);
    }
  });

  it("buildRecommendationIntroText returns French for fr", () => {
    const intro = buildRecommendationIntroText(
      "fr",
      [clientMessage("bonjour, je souhaite acheter une maison à Rome")],
      "lead-fr",
      1,
      {
        intent: "property_search",
        wantsReshow: false,
        wantsMore: false,
        latestMessage: "bonjour, je souhaite acheter une maison à Rome",
      },
      true
    );

    assert.doesNotMatch(intro, /good fit|View details|bedrooms?/i);
    assert.match(intro, /option|intéress|recherche|correspond/i);
  });

  it("PROPERTY_CARD_LABELS.fr uses chambre/chambres and salle de bain/salles de bain", () => {
    assert.equal(PROPERTY_CARD_LABELS.fr.bedroom, "chambre");
    assert.equal(PROPERTY_CARD_LABELS.fr.bedrooms, "chambres");
    assert.equal(PROPERTY_CARD_LABELS.fr.bathroom, "salle de bain");
    assert.equal(PROPERTY_CARD_LABELS.fr.bathrooms, "salles de bain");
  });

  it("LISTING_LABELS.fr is Voir les détails", () => {
    assert.equal(LISTING_LABELS.fr, "🔗 Voir les détails");
  });

  it("formatPropertyWhatsAppPackageText renders French room labels and listing", () => {
    const text = formatPropertyWhatsAppPackageText(sampleProperty(), "fr");

    assert.match(text, /2 chambres/);
    assert.match(text, /2 salles de bain/);
    assert.match(text, /🔗 Voir les détails:/);
    assert.doesNotMatch(text, /bedrooms?|bathrooms?|View details/i);
  });
});
