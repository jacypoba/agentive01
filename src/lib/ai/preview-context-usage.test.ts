import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzePreviewContextUsage } from "@/lib/ai/preview-context-usage";
import type { WorkspaceAISettings } from "@/lib/workspace-settings/types";

const baseSettings: WorkspaceAISettings = {
  workspaceId: "ws-1",
  businessName: "Agentive Estates",
  businessInfo: "Premium real estate agency in Lisbon.",
  toneOfVoice: "Warm and direct",
  areasServed: "Lisbon",
  preferredLanguages: ["en", "pt"],
  defaultLanguage: "en",
  faqs: [
    {
      question: "Do you charge buyer fees?",
      answer: "No buyer fees on standard transactions.",
    },
  ],
  officeHours: "Mon–Fri 9:00–18:00",
  agentBehaviorRules: "Never discuss off-market listings.",
  greetingStyle: "",
  followUpStyle: "",
  updatedAt: null,
};

describe("analyzePreviewContextUsage", () => {
  it("detects FAQ usage when the lead asks a matching question", () => {
    const usage = analyzePreviewContextUsage(
      baseSettings,
      "Do you charge buyer fees?",
      "No buyer fees on standard transactions."
    );

    assert.equal(usage.faqs.configured, true);
    assert.equal(usage.faqs.likelyUsedInReply, true);
    assert.match(usage.faqs.note ?? "", /Matched FAQ/i);
  });

  it("detects company info when the reply mentions the business name", () => {
    const usage = analyzePreviewContextUsage(
      baseSettings,
      "Who are you?",
      "I'm with Agentive Estates — happy to help."
    );

    assert.equal(usage.companyInfo.likelyUsedInReply, true);
  });

  it("detects office hours when the lead asks about availability", () => {
    const usage = analyzePreviewContextUsage(
      baseSettings,
      "What are your office hours?",
      "We're open Mon–Fri 9:00–18:00."
    );

    assert.equal(usage.officeHours.likelyUsedInReply, true);
  });

  it("marks unconfigured sections as not included", () => {
    const usage = analyzePreviewContextUsage(
      {
        ...baseSettings,
        businessName: "",
        businessInfo: "",
        faqs: [],
        officeHours: "",
        toneOfVoice: "",
        agentBehaviorRules: "",
      },
      "Hello",
      "Hi there!"
    );

    assert.equal(usage.companyInfo.configured, false);
    assert.equal(usage.faqs.configured, false);
    assert.equal(usage.officeHours.configured, false);
  });
});
