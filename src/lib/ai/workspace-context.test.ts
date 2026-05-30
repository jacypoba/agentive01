import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWorkspaceAssistantContext,
  workspaceContextFingerprint,
} from "@/lib/ai/workspace-context";
import type { WorkspaceAISettings } from "@/lib/workspace-settings/types";

const baseSettings: WorkspaceAISettings = {
  workspaceId: "ws-1",
  businessName: "",
  businessInfo: "",
  toneOfVoice: "",
  areasServed: "",
  preferredLanguages: ["en"],
  defaultLanguage: "en",
  faqs: [],
  officeHours: "",
  agentBehaviorRules: "",
  greetingStyle: "",
  followUpStyle: "",
  updatedAt: null,
};

describe("buildWorkspaceAssistantContext", () => {
  it("returns empty string when no customization is configured", () => {
    assert.equal(buildWorkspaceAssistantContext(baseSettings), "");
    assert.equal(buildWorkspaceAssistantContext(null), "");
  });

  it("includes agency profile and voice sections when configured", () => {
    const context = buildWorkspaceAssistantContext(
      {
        ...baseSettings,
        businessName: "Agentive Estates",
        toneOfVoice: "Warm and premium",
        greetingStyle: "Casual Olá with first name once",
        areasServed: "Lisbon, Cascais",
        faqs: [{ question: "Do you charge buyer fees?", answer: "No buyer fees." }],
        agentBehaviorRules: "Never discuss off-market listings.",
      },
      { replyLanguage: "pt", isFirstAssistantReply: true, latestClientMessage: "Olá" }
    );

    assert.match(context, /Agentive Estates/);
    assert.match(context, /Warm and premium/);
    assert.match(context, /Lisbon, Cascais/);
    assert.match(context, /Do you charge buyer fees\?/);
    assert.match(context, /rewrite fully in Portuguese/i);
    assert.match(context, /FIRST REPLY ONLY/);
    assert.match(context, /WORKSPACE AGENCY RULES/);
  });

  it("produces meaningfully different prompts for different workspace settings", () => {
    const formal = workspaceContextFingerprint(
      {
        ...baseSettings,
        businessName: "Luxe Lisbon",
        toneOfVoice: "Formal and discreet",
        greetingStyle: "Good afternoon, how may I assist you?",
        businessInfo: "Ultra-luxury brokerage in Chiado.",
      },
      { replyLanguage: "en", latestClientMessage: "Hello" }
    );

    const casual = workspaceContextFingerprint(
      {
        ...baseSettings,
        businessName: "Casas do Porto",
        toneOfVoice: "Casual and upbeat",
        greetingStyle: "Hey! Great to hear from you 👋",
        businessInfo: "Young agency focused on first-time buyers.",
      },
      { replyLanguage: "pt", latestClientMessage: "Olá" }
    );

    assert.notEqual(formal, casual);
    assert.match(formal, /Formal and discreet/);
    assert.match(casual, /Casual and upbeat/);
    assert.match(casual, /Portuguese/);
  });
});
