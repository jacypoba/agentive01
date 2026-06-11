import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractCityFromMessage,
  extractTargetCityFromMessage,
} from "@/lib/properties/normalize-search";

describe("extractTargetCityFromMessage", () => {
  const pivotCases: Array<{ message: string; expected: string }> = [
    {
      message: "Firenze fica longe para mim, tens algo em Milano?",
      expected: "Milano",
    },
    {
      message: "Não quero Roma, prefiro Milano",
      expected: "Milano",
    },
    {
      message: "Rome doesn't work for me, show me Milan",
      expected: "Milano",
    },
    {
      message: "Non mi piace Firenze, avete qualcosa a Milano?",
      expected: "Milano",
    },
    {
      message: "Je ne veux pas Rome, je préfère Milan",
      expected: "Milano",
    },
  ];

  for (const { message, expected } of pivotCases) {
    it(`returns ${expected} for pivot message`, () => {
      const result = extractTargetCityFromMessage(message);
      assert.equal(result.targetCity, expected);
      assert.ok(result.rejectedCities.length >= 1);
      assert.equal(result.confidence, "high");
    });
  }

  it("returns structured evidence for pivot messages", () => {
    const result = extractTargetCityFromMessage(
      "Não quero Roma, prefiro Milano"
    );
    assert.equal(result.targetCity, "Milano");
    assert.deepEqual(result.rejectedCities, ["Roma"]);
    assert.ok(result.evidence.some((entry) => entry.includes("Roma:rejection")));
    assert.ok(result.evidence.some((entry) => entry.includes("Milano:preference")));
  });

  it("keeps single-city extraction for simple searches", () => {
    const result = extractTargetCityFromMessage(
      "Looking for a villa in Milan up to 800k"
    );
    assert.equal(result.targetCity, "Milano");
    assert.deepEqual(result.rejectedCities, []);
    assert.equal(result.confidence, "high");
  });
});

describe("extractCityFromMessage", () => {
  it('extracts Milano from "a villa in Milan" without false positive', () => {
    assert.equal(
      extractCityFromMessage("Looking for a villa in Milan up to 800k"),
      "Milano"
    );
  });

  it("prefers pivot target over rejected city", () => {
    assert.equal(
      extractCityFromMessage(
        "Firenze fica longe para mim, tens algo em Milano?"
      ),
      "Milano"
    );
  });
});
