import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONVERSATIONAL_OPENERS,
  isClearlyQuestion,
  normalizeConversationalPunctuation,
  pickConversationalOpener,
  pickOpenerStyle,
  polishConversationalReply,
  reduceQuestionChaining,
  withConversationalOpener,
} from "@/lib/ai/conversation-quality-v1";
import { finalizeWhatsAppText } from "@/lib/ai/complete-response";
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
      normalizeConversationalPunctuation("Claro, volto a enviar", "pt"),
      "Claro, volto a enviar."
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

describe("withConversationalOpener V1.1", () => {
  it("never uses em dash between opener and body", () => {
    for (let i = 0; i < 30; i += 1) {
      const text = withConversationalOpener(
        "al momento non ho nulla a Firenze",
        "it",
        `seed-${i}`
      );
      assert.equal(text.includes("—"), false);
      assert.equal(text.includes("–"), false);
    }
  });

  it("supports comma, period, and no-opener styles", () => {
    const styles = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      styles.add(pickOpenerStyle(`variation-${i}`));
    }
    assert.equal(styles.has("none"), true);
    assert.equal(styles.has("comma"), true);
    assert.equal(styles.has("period"), true);
  });

  it("formats comma style naturally", () => {
    const commaSeed = Array.from({ length: 100 }, (_, index) => `comma-${index}`).find(
      (seed) => pickOpenerStyle(seed) === "comma"
    );
    assert.ok(commaSeed);

    const text = withConversationalOpener(
      "al momento non ho nulla a Firenze",
      "it",
      commaSeed!
    );
    assert.match(text, /^[^,]+, al momento/i);
  });

  it("formats period style naturally", () => {
    const periodSeed = Array.from({ length: 100 }, (_, index) => `period-${index}`).find(
      (seed) => pickOpenerStyle(seed) === "period"
    );
    assert.ok(periodSeed);

    const text = withConversationalOpener(
      "al momento non ho nulla a Firenze",
      "it",
      periodSeed!
    );
    assert.match(text, /^[^.]+\. Al momento/i);
  });

  it("allows no opener with capitalized body", () => {
    const noneSeed = Array.from({ length: 100 }, (_, index) => `none-${index}`).find(
      (seed) => pickOpenerStyle(seed) === "none"
    );
    assert.ok(noneSeed);

    const text = withConversationalOpener(
      "al momento non ho nulla a Firenze",
      "it",
      noneSeed!
    );
    assert.equal(text, "Al momento non ho nulla a Firenze");
  });

  it("rewrites legacy em dash openers via polish", () => {
    const polished = polishConversationalReply(
      "Capisco — al momento non ho nulla a Firenze",
      "it",
      "legacy-test"
    );
    assert.equal(polished.includes("—"), false);
  });
});

describe("city fallback punctuation", () => {
  for (const language of ["pt", "it", "en", "es", "fr"] as SupportedLanguage[]) {
    it(`ends ${language} city fallback with ?`, () => {
      const text = buildCityAlternativeFallbackText(language, firenzeSummary);
      assert.match(text, /\?$/);
      assert.match(text, /Milano/i);
      assert.equal(text.includes("—"), false);
    });
  }

  it("Italian fallback mentions Firenze and Navigli without em dash", () => {
    const text = buildCityAlternativeFallbackText("it", firenzeSummary);
    assert.equal(text.includes("—"), false);
    assert.match(text, /Firenze/i);
    assert.match(text, /Navigli/i);
    assert.equal(text.endsWith("?"), true);
  });

  it("varies opener style across cities", () => {
    const samples = Array.from({ length: 40 }, (_, index) =>
      buildCityAlternativeFallbackText("it", {
        ...firenzeSummary,
        requestedCity: `City-${index}`,
      })
    );
    const withComma = samples.filter((text) => /^[^.]+\, /i.test(text));
    const withPeriod = samples.filter((text) => /^[^,]+\. /i.test(text));
    const withoutOpener = samples.filter(
      (text) =>
        !CONVERSATIONAL_OPENERS.it.some((opener) =>
          text.startsWith(`${opener},`) || text.startsWith(`${opener}.`)
        )
    );
    assert.ok(withComma.length > 0);
    assert.ok(withPeriod.length > 0);
    assert.ok(withoutOpener.length > 0);
  });
});

describe("multilingual conversational templates", () => {
  const languages: SupportedLanguage[] = ["pt", "en", "it", "es", "fr"];

  for (const language of languages) {
    it(`pickNoMatchIntroReply ${language} avoids em dash`, () => {
      const reply = pickNoMatchIntroReply(language, [], `lead-${language}`);
      assert.equal(reply.includes("—"), false);
    });

    it(`pickNoMatchIntroReply ${language} ends questions with ?`, () => {
      const reply = pickNoMatchIntroReply(language, [], `lead-q-${language}`);
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

  it("polishConversationalReply fixes no-match question punctuation", () => {
    const polished = polishConversationalReply(
      "por agora nada encaixa. Quer ajustar algum critério",
      "pt",
      "no-match-q"
    );
    assert.equal(polished.endsWith("?"), true);
    assert.equal(polished.includes("—"), false);
  });
});
