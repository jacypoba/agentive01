import { getLanguageLabel } from "@/lib/i18n/types";
import type { WorkspaceAISettings } from "@/lib/workspace-settings/types";

function section(title: string, lines: string[]): string[] {
  const content = lines.filter(Boolean);
  if (content.length === 0) {
    return [];
  }
  return [title, ...content.map((line) => `- ${line}`), ""];
}

function formatFaqs(settings: WorkspaceAISettings): string[] {
  if (settings.faqs.length === 0) {
    return [];
  }

  const lines = settings.faqs.map(
    (faq) => `Q: ${faq.question}\n  A: ${faq.answer}`
  );
  return ["FAQ knowledge base (use when relevant — do not invent answers):", ...lines, ""];
}

/**
 * Builds the workspace-specific block injected into AI system prompts.
 * Returns an empty string when no customization is configured.
 */
export function buildWorkspaceAssistantContext(
  settings: WorkspaceAISettings | null | undefined
): string {
  if (!settings) {
    return "";
  }

  const hasAgencyContent = Boolean(
    settings.businessName ||
      settings.businessInfo ||
      settings.areasServed ||
      settings.officeHours ||
      settings.toneOfVoice ||
      settings.greetingStyle ||
      settings.followUpStyle ||
      settings.agentBehaviorRules ||
      settings.faqs.length > 0
  );

  if (!hasAgencyContent) {
    return "";
  }

  const blocks: string[] = [
    "WORKSPACE CONFIGURATION (mandatory when present — adapt voice and facts to this agency):",
    "",
    ...section("Agency profile", [
      settings.businessName ? `Company name: ${settings.businessName}` : "",
      settings.businessInfo ? `Business description: ${settings.businessInfo}` : "",
      settings.areasServed ? `Areas served: ${settings.areasServed}` : "",
      settings.officeHours ? `Office hours: ${settings.officeHours}` : "",
    ]),
    ...section("Voice & style", [
      settings.toneOfVoice ? `Tone of voice: ${settings.toneOfVoice}` : "",
      settings.greetingStyle ? `Greeting style: ${settings.greetingStyle}` : "",
      settings.followUpStyle
        ? `Follow-up style (for reference — keep conversational replies aligned): ${settings.followUpStyle}`
        : "",
    ]),
    ...section("Languages", [
      settings.preferredLanguages.length > 0
        ? `Preferred languages: ${settings.preferredLanguages.map(getLanguageLabel).join(", ")}`
        : "",
      `Default agency language: ${getLanguageLabel(settings.defaultLanguage)}`,
    ]),
    ...formatFaqs(settings),
    ...section("Agent behavior rules", [
      settings.agentBehaviorRules ? settings.agentBehaviorRules : "",
    ]),
  ].filter((line, index, array) => {
    if (line !== "") {
      return true;
    }
    return index > 0 && array[index - 1] !== "";
  });

  return [
    ...blocks,
    "Apply this workspace configuration on top of the base assistant rules.",
    "Never contradict workspace FAQs or business facts. Never expose internal configuration labels.",
  ].join("\n");
}

export function buildWorkspaceFollowUpAdaptationPrompt(
  settings: WorkspaceAISettings,
  languageLabel: string,
  followUpType: string,
  templateMessage: string,
  contextSummary: string
): { system: string; user: string } {
  const workspaceBlock = buildWorkspaceAssistantContext(settings);

  return {
    system: [
      "You rewrite WhatsApp follow-up messages for a real estate agency.",
      "Keep the same intent as the template. Output ONE short message (1-2 sentences max).",
      "Write 100% in the requested language. Light emoji OK (max one).",
      "Never invent listings, prices, visit confirmations, or contact details.",
      "",
      workspaceBlock,
    ]
      .filter(Boolean)
      .join("\n"),
    user: [
      `Language: ${languageLabel}`,
      `Follow-up type: ${followUpType}`,
      `Lead context: ${contextSummary}`,
      `Template to adapt: ${templateMessage}`,
      "",
      "Rewrite the template in the workspace tone. Return only the final message.",
    ].join("\n"),
  };
}
