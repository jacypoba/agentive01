import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectLanguageFromText } from "@/lib/i18n/detect-language";
import {
  enforceReplyLanguage,
  hasLanguageMixing,
} from "@/lib/i18n/language-purity";
import { generateLocalizedFollowUpMessage } from "@/lib/i18n/messages";
import { resolveConversationLanguage } from "@/lib/i18n/resolve-language";
import { buildVisitConfirmedMessage } from "@/lib/visits/whatsapp-notifications";
import { parseRequestedVisitDatetime } from "@/lib/visits/parse-datetime";

describe("detectLanguageFromText", () => {
  it("detects Portuguese", () => {
    assert.equal(
      detectLanguageFromText("Está bem, obrigado"),
      "pt"
    );
  });

  it("detects perfeito as Portuguese", () => {
    assert.equal(
      detectLanguageFromText("Perfeito, quero visitar segunda-feira"),
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

describe("resolveConversationLanguage", () => {
  it("uses latest Portuguese message even when lead preferred is Spanish", () => {
    assert.equal(
      resolveConversationLanguage({
        latestMessage: "Quero marcar visita para segunda-feira de manhã",
        leadPreferred: "es",
      }),
      "pt"
    );
  });

  it("falls back to lead preferred language for ambiguous latest message", () => {
    assert.equal(
      resolveConversationLanguage({
        latestMessage: "ok",
        leadPreferred: "it",
      }),
      "it"
    );
  });

  it("honours explicit language switch requests", () => {
    assert.equal(
      resolveConversationLanguage({
        latestMessage: "Can you reply in English please?",
        leadPreferred: "pt",
      }),
      "en"
    );
  });
});

describe("language purity guardrails", () => {
  it("flags Spanish mixed into Portuguese replies", () => {
    assert.equal(
      hasLanguageMixing("Perfecto, quedó agendada para segunda-feira", "pt"),
      true
    );
  });

  it("replaces mixed replies with a monolingual fallback", () => {
    const result = enforceReplyLanguage(
      "Perfecto, quedó agendada para segunda-feira",
      "pt"
    );
    assert.equal(result.adjusted, true);
    assert.match(result.text, /Claro|vejo|perfil/i);
    assert.equal(hasLanguageMixing(result.text, "pt"), false);
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

  it("formats Portuguese visit slot in Portuguese template", () => {
    const slot = parseRequestedVisitDatetime(
      "segunda-feira às 10h",
      60,
      new Date("2026-05-18T12:00:00"),
      "pt"
    );
    assert.ok(slot);
    const message = buildVisitConfirmedMessage(
      { preferred_language: "pt" },
      "segunda-feira às 10h",
      slot!.displayText,
      "pt"
    );
    assert.match(message, /Perfeito/i);
    assert.doesNotMatch(message, /Perfecto|Quedó/i);
    assert.match(message, /às/i);
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
