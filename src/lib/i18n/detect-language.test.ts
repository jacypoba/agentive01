import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectLanguageFromText } from "@/lib/i18n/detect-language";
import { generateLocalizedFollowUpMessage } from "@/lib/i18n/messages";
import { buildVisitConfirmedMessage } from "@/lib/visits/whatsapp-notifications";

describe("detectLanguageFromText", () => {
  it("detects Portuguese", () => {
    assert.equal(
      detectLanguageFromText("Está bem, obrigado"),
      "pt"
    );
  });

  it("detects English", () => {
    assert.equal(
      detectLanguageFromText("Thanks, looking for an apartment in Milan"),
      "en"
    );
  });

  it("detects Italian", () => {
    assert.equal(
      detectLanguageFromText("Cerco appartamento a Milano fino a 600 mil"),
      "it"
    );
  });

  it("detects Spanish", () => {
    assert.equal(
      detectLanguageFromText("Busco apartamento en Milano hasta 600 mil"),
      "es"
    );
  });
});

describe("localized outbound messages", () => {
  it("generates English visit confirmation", () => {
    const message = buildVisitConfirmedMessage(
      { preferred_language: "en" },
      "tomorrow at 3pm",
      "tomorrow at 3pm"
    );
    assert.match(message, /Perfect/i);
    assert.match(message, /tomorrow at 3pm/);
  });

  it("generates Italian follow-up", () => {
    const message = generateLocalizedFollowUpMessage(
      "it",
      "silent_lead",
      { city: "Milano" },
      "seed"
    );
    assert.match(message, /Milano|disponibile|riprendere/i);
  });
});
