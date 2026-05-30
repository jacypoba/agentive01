import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWorkspaceAssistantContext } from "@/lib/ai/workspace-context";
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
    const context = buildWorkspaceAssistantContext({
      ...baseSettings,
      businessName: "Agentive Estates",
      toneOfVoice: "Warm and premium",
      areasServed: "Lisbon, Cascais",
      faqs: [{ question: "Do you charge buyer fees?", answer: "No buyer fees." }],
      agentBehaviorRules: "Never discuss off-market listings.",
    });

    assert.match(context, /Agentive Estates/);
    assert.match(context, /Warm and premium/);
    assert.match(context, /Lisbon, Cascais/);
    assert.match(context, /Do you charge buyer fees\?/);
    assert.match(context, /Never discuss off-market listings/);
    assert.match(context, /WORKSPACE CONFIGURATION/);
  });
});
