import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONVERSATIONAL_OPENERS,
  isClearlyQuestion,
  normalizeConversationalPunctuation,
  pickConversationalOpener,
  polishConversationalReply,
  reduceQuestionChaining,
} from "@/lib/ai/conversation-quality-v1";
import { finalizeWhatsAppText } from "@/lib/ai/complete-response";
import { NO_MATCH_LINES } from "@/lib/i18n/messages";
import { pickNoMatchIntroReply } from "@/lib/ai/no-match-reply";
import { buildCityAlternativeFallbackText } from "@/lib/properties/city-alternatives";
import type { CityAlternativeSummary } from "@/lib/properties/city-alternatives";
import type { SupportedLanguage } from "@/lib/i18n/types";

const firenzeSummary: CityAlternativeSummary = {
  requestedCity: "Firenze",
  availableCities: ["Milano"],
  availableAreas: ["Navigli"],
  primaryCity: "Milano",
  primaryAreas: ["Navigli"],
};

describe("normalizeConversationalPunctuation", () => {
  it("adds ? to clearly interrogative PT lines missing punctuation", () => {
    const result = normalizeConversationalPunctuation(
      "Quer ajustar algum critério",
      "pt"
    );
    assert.equal(result, "Quer ajustar algum critério?");
  });

  it("adds ? to IT question without terminal mark", () => {
    const result = normalizeConversationalPunctuation(
      "Vuoi modificare qualche criterio",
      "it"
    );
    assert.equal(result, "Vuoi modificare qualche criterio?");
  });

  it("adds ? to EN preferred-area ask", () => {
    const result = normalizeConversationalPunctuation(
      "Any preferred area",
      "en"
    );
    assert.equal(result, "Any preferred area?");
  });

  it("keeps existing ? and does not convert statements", () => {
    assert.equal(
      normalizeConversationalPunctuation(
        "Por agora nada encaixa neste perfil.",
        "pt"
      ),
      "Por agora nada encaixa neste perfil."
    );
    assert.equal(
      normalizeConversationalPunctuation("Would you like a visit?", "en"),
      "Would you like a visit?"
    );
  });

  it("adds . to short statements without terminal punctuation", () => {
    assert.equal(
      normalizeConversationalPunctuation("Claro — volto a enviar", "pt"),
      "Claro — volto a enviar."
    );
  });
});

describe("reduceQuestionChaining", () => {
  it("keeps only the first question when two are stacked", () => {
    const chained =
      "Would you like Milano? Should I also check Rome for you?";
    const result = reduceQuestionChaining(chained, "en");
    assert.equal(result, "Would you like Milano?");
  });
});

describe("finalizeWhatsAppText question preservation", () => {
  it("does not strip trailing question marks", () => {
    assert.equal(
      finalizeWhatsAppText("Would you like me to show them?"),
      "Would you like me to show them?"
    );
  });
});

describe("city fallback punctuation", () => {
  for (const language of ["pt", "it", "en", "es", "fr"] as SupportedLanguage[]) {
    it(`ends ${language} city fallback with ?`, () => {
      const text = buildCityAlternativeFallbackText(language, firenzeSummary);
      assert.match(text, /\?$/);
      assert.match(text, /Milano/i);
    });
  }

  it("Italian fallback mentions Firenze and Navigli with conversational opener", () => {
    const text = buildCityAlternativeFallbackText("it", firenzeSummary);
    assert.match(text, /^(Capisco|Certo|Perfetto)/);
    assert.match(text, /Firenze/i);
    assert.match(text, /Navigli/i);
    assert.equal(text.endsWith("?"), true);
  });
});

describe("multilingual conversational templates", () => {
  const languages: SupportedLanguage[] = ["pt", "en", "it", "es", "fr"];

  for (const language of languages) {
    it(`NO_MATCH_LINES ${language} use approved openers on first variant`, () => {
      const first = NO_MATCH_LINES[language][0]!;
      const openers = CONVERSATIONAL_OPENERS[language];
      const startsWithOpener = openers.some((opener) =>
        first.startsWith(opener)
      );
      assert.equal(startsWithOpener, true);
    });

    it(`pickNoMatchIntroReply ${language} ends questions with ?`, () => {
      const reply = pickNoMatchIntroReply(language, [], `lead-${language}`);
      if (isClearlyQuestion(reply, language)) {
        assert.match(reply, /\?$/);
      }
    });
  }

  it("pickConversationalOpener rotates per seed", () => {
    const a = pickConversationalOpener("pt", "seed-a");
    const b = pickConversationalOpener("pt", "seed-b");
    assert.ok(CONVERSATIONAL_OPENERS.pt.includes(a));
    assert.ok(CONVERSATIONAL_OPENERS.pt.includes(b));
  });

  it("polishConversationalReply fixes no-match variant punctuation", () => {
    const raw = NO_MATCH_LINES.pt[1]!;
    const polished = polishConversationalReply(raw, "pt");
    assert.equal(polished.endsWith("?"), true);
  });
});
