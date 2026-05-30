import type { WorkspaceAISettings } from "@/lib/workspace-settings/types";
import { getLanguageLabel, type SupportedLanguage } from "@/lib/i18n/types";

export type WorkspacePromptOptions = {
  /** Detected language of the client's latest message — highest priority for replies. */
  replyLanguage: SupportedLanguage;
  latestClientMessage?: string;
  /** True when the assistant has not replied yet in this thread. */
  isFirstAssistantReply?: boolean;
};

function section(title: string, lines: string[]): string[] {
  const content = lines.filter(Boolean);
  if (content.length === 0) {
    return [];
  }
  return [title, ...content.map((line) => `- ${line}`), ""];
}

function formatFaqs(
  settings: WorkspaceAISettings,
  replyLanguage: SupportedLanguage
): string[] {
  if (settings.faqs.length === 0) {
    return [];
  }

  const languageLabel = getLanguageLabel(replyLanguage);
  const lines = settings.faqs.map(
    (faq) => `Q: ${faq.question}\n  A (source facts — rewrite fully in ${languageLabel}): ${faq.answer}`
  );

  return [
    `FAQ KNOWLEDGE (mandatory when the client question matches):`,
    `- Use ONLY these facts. NEVER invent answers.`,
    `- Write the answer entirely in ${languageLabel}, even if the stored answer is in another language.`,
    `- Do not paste FAQ text verbatim if it is not in ${languageLabel}.`,
    ...lines,
    "",
  ];
}

function hasWorkspaceContent(settings: WorkspaceAISettings): boolean {
  return Boolean(
    settings.businessName.trim() ||
      settings.businessInfo.trim() ||
      settings.areasServed.trim() ||
      settings.officeHours.trim() ||
      settings.toneOfVoice.trim() ||
      settings.greetingStyle.trim() ||
      settings.followUpStyle.trim() ||
      settings.agentBehaviorRules.trim() ||
      settings.faqs.length > 0
  );
}

/**
 * Builds the workspace-specific block injected into AI system prompts.
 * Returns an empty string when no customization is configured.
 */
export function buildWorkspaceAssistantContext(
  settings: WorkspaceAISettings | null | undefined,
  options?: WorkspacePromptOptions
): string {
  if (!settings || !hasWorkspaceContent(settings)) {
    return "";
  }

  const replyLanguage = options?.replyLanguage ?? settings.defaultLanguage;
  const languageLabel = getLanguageLabel(replyLanguage);
  const isFirst = options?.isFirstAssistantReply ?? false;

  const blocks: string[] = [
    "=== WORKSPACE AGENCY RULES (BINDING — must shape wording, facts, and recommendations) ===",
    "",
    `Client reply language: ${languageLabel}. Workspace preferred/default languages are secondary — always match the client's latest message language.`,
    "",
    ...section("Agency identity", [
      settings.businessName
        ? `Company name: ${settings.businessName} — mention naturally when introducing the agency or building trust; do not force it in every message.`
        : "",
      settings.businessInfo
        ? `Business description: ${settings.businessInfo} — let this materially shape how you describe the service, positioning, and property recommendations.`
        : "",
      settings.areasServed
        ? `Areas served: ${settings.areasServed} — prioritize and reference these areas when discussing locations.`
        : "",
      settings.officeHours
        ? `Office hours: ${settings.officeHours} — use when the client asks about availability, contact times, or scheduling.`
        : "",
    ]),
    ...section("Voice & style (mandatory)", [
      settings.toneOfVoice
        ? `Tone of voice: ${settings.toneOfVoice} — EVERY sentence must reflect this tone; avoid generic support-bot phrasing.`
        : "",
      isFirst && settings.greetingStyle
        ? `Greeting style (FIRST REPLY ONLY): ${settings.greetingStyle} — your opening sentence MUST follow this style before anything else.`
        : settings.greetingStyle
          ? `Greeting style (reference): ${settings.greetingStyle}`
          : "",
      settings.followUpStyle
        ? `Follow-up style: ${settings.followUpStyle} — keep re-engagement messages aligned with this style.`
        : "",
    ]),
    ...formatFaqs(settings, replyLanguage),
    ...section("Agent behavior rules (hard constraints)", [
      settings.agentBehaviorRules ? settings.agentBehaviorRules : "",
    ]),
    "Do not expose internal labels like 'workspace configuration' or 'FAQ database'.",
    "Never contradict workspace facts. Never invent details beyond what is configured.",
  ].filter((line, index, array) => {
    if (line !== "") {
      return true;
    }
    return index > 0 && array[index - 1] !== "";
  });

  return blocks.join("\n");
}

export function buildWorkspaceFollowUpAdaptationPrompt(
  settings: WorkspaceAISettings,
  language: SupportedLanguage,
  followUpType: string,
  templateMessage: string,
  contextSummary: string
): { system: string; user: string } {
  const languageLabel = getLanguageLabel(language);
  const workspaceBlock = buildWorkspaceAssistantContext(settings, {
    replyLanguage: language,
  });

  const styleLines = [
    settings.toneOfVoice
      ? `Tone of voice (mandatory): ${settings.toneOfVoice}`
      : "",
    settings.followUpStyle
      ? `Follow-up style (mandatory — must materially change phrasing): ${settings.followUpStyle}`
      : "",
    settings.businessName
      ? `Company: ${settings.businessName} — mention only if natural.`
      : "",
  ].filter(Boolean);

  return {
    system: [
      "You rewrite WhatsApp follow-up messages for a real estate agency.",
      `Write 100% in ${languageLabel}. Detected lead language overrides workspace defaults.`,
      "Output ONE short message (1-2 sentences max). Light emoji OK (max one).",
      "Never invent listings, prices, visit confirmations, or contact details.",
      "Forbidden: Got it, Okay, generic 'Boa' openers.",
      "",
      ...styleLines,
      "",
      workspaceBlock,
    ]
      .filter(Boolean)
      .join("\n"),
    user: [
      `Language: ${languageLabel}`,
      `Follow-up type: ${followUpType}`,
      `Lead context: ${contextSummary}`,
      `Template intent (rewrite in workspace tone, not copy): ${templateMessage}`,
      "",
      "Rewrite in the workspace tone and follow-up style. Return only the final message.",
    ].join("\n"),
  };
}

/** Fingerprint for tests — settings should produce distinct prompt material. */
export function workspaceContextFingerprint(
  settings: WorkspaceAISettings,
  options: WorkspacePromptOptions
): string {
  return buildWorkspaceAssistantContext(settings, options);
}
