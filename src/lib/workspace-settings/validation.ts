import {
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n/types";
import type {
  WorkspaceAISettingsInput,
  WorkspaceFaqItem,
} from "@/lib/workspace-settings/types";

export type ValidationResult =
  | { ok: true; value: WorkspaceAISettingsInput }
  | { ok: false; error: string };

const LIMITS = {
  businessName: 120,
  businessInfo: 2000,
  toneOfVoice: 500,
  areasServed: 500,
  officeHours: 500,
  agentBehaviorRules: 2000,
  greetingStyle: 500,
  followUpStyle: 500,
  faqQuestion: 300,
  faqAnswer: 1000,
  maxFaqs: 50,
} as const;

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseFaqItems(raw: unknown): WorkspaceFaqItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: WorkspaceFaqItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const question = trim((entry as { question?: unknown }).question);
    const answer = trim((entry as { answer?: unknown }).answer);
    if (!question && !answer) {
      continue;
    }
    items.push({ question, answer });
  }
  return items;
}

function parsePreferredLanguages(raw: unknown): SupportedLanguage[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const languages: SupportedLanguage[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && isSupportedLanguage(entry.trim())) {
      const code = entry.trim() as SupportedLanguage;
      if (!languages.includes(code)) {
        languages.push(code);
      }
    }
  }
  return languages;
}

export function validateWorkspaceAISettingsInput(
  input: WorkspaceAISettingsFormInput
): ValidationResult {
  const businessName = trim(input.businessName);
  const businessInfo = trim(input.businessInfo);
  const toneOfVoice = trim(input.toneOfVoice);
  const areasServed = trim(input.areasServed);
  const officeHours = trim(input.officeHours);
  const agentBehaviorRules = trim(input.agentBehaviorRules);
  const greetingStyle = trim(input.greetingStyle);
  const followUpStyle = trim(input.followUpStyle);

  if (businessName.length > LIMITS.businessName) {
    return { ok: false, error: `Company name must be at most ${LIMITS.businessName} characters.` };
  }
  if (businessInfo.length > LIMITS.businessInfo) {
    return { ok: false, error: `Business description must be at most ${LIMITS.businessInfo} characters.` };
  }
  if (toneOfVoice.length > LIMITS.toneOfVoice) {
    return { ok: false, error: `Tone of voice must be at most ${LIMITS.toneOfVoice} characters.` };
  }
  if (areasServed.length > LIMITS.areasServed) {
    return { ok: false, error: `Areas served must be at most ${LIMITS.areasServed} characters.` };
  }
  if (officeHours.length > LIMITS.officeHours) {
    return { ok: false, error: `Office hours must be at most ${LIMITS.officeHours} characters.` };
  }
  if (agentBehaviorRules.length > LIMITS.agentBehaviorRules) {
    return {
      ok: false,
      error: `Agent behavior instructions must be at most ${LIMITS.agentBehaviorRules} characters.`,
    };
  }
  if (greetingStyle.length > LIMITS.greetingStyle) {
    return { ok: false, error: `Greeting style must be at most ${LIMITS.greetingStyle} characters.` };
  }
  if (followUpStyle.length > LIMITS.followUpStyle) {
    return { ok: false, error: `Follow-up style must be at most ${LIMITS.followUpStyle} characters.` };
  }

  const preferredLanguages = parsePreferredLanguages(input.preferredLanguages);
  if (preferredLanguages.length === 0) {
    return { ok: false, error: "Select at least one preferred language." };
  }
  if (preferredLanguages.length > SUPPORTED_LANGUAGES.length) {
    return { ok: false, error: "Too many preferred languages selected." };
  }

  const defaultLanguageRaw = trim(input.defaultLanguage);
  const defaultLanguage = isSupportedLanguage(defaultLanguageRaw)
    ? defaultLanguageRaw
    : preferredLanguages[0];

  if (!preferredLanguages.includes(defaultLanguage)) {
    return {
      ok: false,
      error: "Primary language must be included in preferred languages.",
    };
  }

  const faqs = parseFaqItems(input.faqs);
  if (faqs.length > LIMITS.maxFaqs) {
    return { ok: false, error: `FAQ knowledge base supports at most ${LIMITS.maxFaqs} entries.` };
  }

  for (const [index, faq] of faqs.entries()) {
    if (!faq.question) {
      return { ok: false, error: `FAQ #${index + 1} is missing a question.` };
    }
    if (!faq.answer) {
      return { ok: false, error: `FAQ #${index + 1} is missing an answer.` };
    }
    if (faq.question.length > LIMITS.faqQuestion) {
      return {
        ok: false,
        error: `FAQ #${index + 1} question must be at most ${LIMITS.faqQuestion} characters.`,
      };
    }
    if (faq.answer.length > LIMITS.faqAnswer) {
      return {
        ok: false,
        error: `FAQ #${index + 1} answer must be at most ${LIMITS.faqAnswer} characters.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      businessName,
      businessInfo,
      toneOfVoice,
      areasServed,
      preferredLanguages,
      defaultLanguage,
      faqs,
      officeHours,
      agentBehaviorRules,
      greetingStyle,
      followUpStyle,
    },
  };
}

export type WorkspaceAISettingsFormInput = Partial<
  Omit<WorkspaceAISettingsInput, "preferredLanguages" | "faqs" | "defaultLanguage">
> & {
  preferredLanguages?: unknown;
  defaultLanguage?: string;
  faqs?: unknown;
};

export function parseWorkspaceAISettingsFromFormData(
  formData: FormData
): WorkspaceAISettingsFormInput {
  let faqs: unknown = [];
  const faqsRaw = formData.get("faqs_json");
  if (typeof faqsRaw === "string" && faqsRaw.trim()) {
    try {
      faqs = JSON.parse(faqsRaw);
    } catch {
      faqs = [];
    }
  }

  const preferredLanguages: unknown = formData
    .getAll("preferred_languages")
    .map((value) => String(value));

  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };

  return {
    businessName: field("business_name"),
    businessInfo: field("business_info"),
    toneOfVoice: field("tone_of_voice"),
    areasServed: field("areas_served"),
    preferredLanguages,
    defaultLanguage: field("default_language"),
    faqs,
    officeHours: field("office_hours"),
    agentBehaviorRules: field("agent_behavior_rules"),
    greetingStyle: field("greeting_style"),
    followUpStyle: field("follow_up_style"),
  };
}
