import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  finalizeWhatsAppLines,
  finalizeWhatsAppText,
  isIncompleteResponse,
  truncateAtSentenceBoundary,
} from "@/lib/ai/complete-response";

describe("isIncompleteResponse", () => {
  it("flags trailing both with ellipsis", () => {
    assert.equal(
      isIncompleteResponse(
        "THE SECOND ONE OFFERS AN EXTRA BEDROOM AND BATHROOM, MAXIMIZING SPACE FOR COMFORT. BOTH..."
      ),
      true
    );
  });

  it("flags unfinished conjunctions", () => {
    assert.equal(isIncompleteResponse("Nice options, and"), true);
    assert.equal(isIncompleteResponse("Ottima scelta, ma"), true);
  });

  it("accepts complete sentences", () => {
    assert.equal(
      isIncompleteResponse(
        "The second option adds an extra bedroom — more space if comfort matters."
      ),
      false
    );
  });
});

describe("truncateAtSentenceBoundary", () => {
  it("cuts at the last sentence instead of mid-word", () => {
    const long =
      "The first is more central. The second adds an extra bedroom and bathroom for families.";
    const result = truncateAtSentenceBoundary(long, 55);
    assert.equal(result.endsWith("."), true);
    assert.equal(result.includes("bedroom and bath"), false);
  });
});

describe("finalizeWhatsAppLines", () => {
  it("returns null for incomplete AI output", () => {
    assert.equal(
      finalizeWhatsAppLines("Strong value in the first. Both..."),
      null
    );
  });

  it("keeps two complete comparison lines", () => {
    const result = finalizeWhatsAppLines(
      "The first is walkable to the centre.\nThe second adds an extra bedroom."
    );
    assert.ok(result);
    assert.equal(result.split("\n").length, 2);
    assert.equal(isIncompleteResponse(result!), false);
  });
});

describe("finalizeWhatsAppText", () => {
  it("adds punctuation when missing", () => {
    assert.equal(finalizeWhatsAppText("Boa escolha"), "Boa escolha.");
  });

  it("preserves question marks on complete questions", () => {
    assert.equal(
      finalizeWhatsAppText("Would you like me to show them?"),
      "Would you like me to show them?"
    );
  });
});
