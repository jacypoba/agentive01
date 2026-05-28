import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation } from "@/types/database";
import {
  buildRecommendationIntroText,
  shouldUseFirstRecommendationIntro,
} from "@/lib/properties/recommendation-intros";

function clientMessage(text: string): Conversation {
  return {
    id: `client-${text.slice(0, 6)}`,
    lead_id: "lead-1",
    message: text,
    sender: "client",
    created_at: new Date().toISOString(),
  };
}

function aiMessage(text: string): Conversation {
  return {
    id: `ai-${text.slice(0, 6)}`,
    lead_id: "lead-1",
    message: text,
    sender: "ai",
    created_at: new Date().toISOString(),
  };
}

describe("shouldUseFirstRecommendationIntro", () => {
  it("uses first-batch intro when no properties were shown before", () => {
    const history = [clientMessage("Looking for a villa in Milan")];
    assert.equal(
      shouldUseFirstRecommendationIntro(
        history,
        {
          intent: "property_search",
          wantsReshow: false,
          wantsMore: false,
          latestMessage: history[0].message,
        },
        true
      ),
      true
    );
  });

  it("uses more-options intro after properties were already sent", () => {
    const history = [
      clientMessage("show more"),
      aiMessage("Tenho mais algumas 👇"),
      aiMessage('🏡 Villa Milano\n[property:abc-123]'),
    ];
    assert.equal(
      shouldUseFirstRecommendationIntro(
        history,
        {
          intent: "ask_more_options",
          wantsReshow: false,
          wantsMore: true,
          latestMessage: "show more",
        },
        true
      ),
      false
    );
  });
});

describe("buildRecommendationIntroText", () => {
  it("returns English first-batch catalog intro", () => {
    const intro = buildRecommendationIntroText(
      "en",
      [clientMessage("Looking for apartment in Milan")],
      "lead-1",
      3,
      {
        intent: "property_search",
        wantsReshow: false,
        wantsMore: false,
        latestMessage: "Looking for apartment in Milan",
      },
      true
    );

    assert.match(intro, /Perfect|Got it|Nice|Great/i);
  });

  it("returns Portuguese first-batch intro", () => {
    const intro = buildRecommendationIntroText(
      "pt",
      [clientMessage("Procuro apartamento em Milano")],
      "lead-1",
      2,
      {
        intent: "property_search",
        wantsReshow: false,
        wantsMore: false,
        latestMessage: "Procuro apartamento em Milano",
      },
      true
    );

    assert.match(intro, /Perfeito|perfil|Boa|Fixe/i);
  });
});
