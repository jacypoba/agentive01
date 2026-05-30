import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateWorkspaceAISettingsInput,
} from "@/lib/workspace-settings/validation";

describe("validateWorkspaceAISettingsInput", () => {
  it("accepts a valid minimal payload", () => {
    const result = validateWorkspaceAISettingsInput({
      businessName: "Agentive Estates",
      preferredLanguages: ["en", "pt"],
      defaultLanguage: "en",
      faqs: [{ question: "Hours?", answer: "Mon–Fri 9–18." }],
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.businessName, "Agentive Estates");
      assert.deepEqual(result.value.preferredLanguages, ["en", "pt"]);
    }
  });

  it("rejects empty preferred languages", () => {
    const result = validateWorkspaceAISettingsInput({
      preferredLanguages: [],
      defaultLanguage: "en",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /at least one preferred language/i);
    }
  });

  it("rejects primary language outside preferred languages", () => {
    const result = validateWorkspaceAISettingsInput({
      preferredLanguages: ["pt"],
      defaultLanguage: "en",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Primary language must be included/i);
    }
  });

  it("rejects incomplete FAQ entries", () => {
    const result = validateWorkspaceAISettingsInput({
      preferredLanguages: ["en"],
      defaultLanguage: "en",
      faqs: [{ question: "Missing answer", answer: "" }],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /missing an answer/i);
    }
  });

  it("enforces field length limits", () => {
    const result = validateWorkspaceAISettingsInput({
      businessName: "x".repeat(121),
      preferredLanguages: ["en"],
      defaultLanguage: "en",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Company name must be at most 120/i);
    }
  });
});
