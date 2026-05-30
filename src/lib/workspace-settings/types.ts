import type { SupportedLanguage } from "@/lib/i18n/types";

export type WorkspaceFaqItem = {
  question: string;
  answer: string;
};

export type WorkspaceAISettings = {
  workspaceId: string;
  businessName: string;
  businessInfo: string;
  toneOfVoice: string;
  areasServed: string;
  preferredLanguages: SupportedLanguage[];
  defaultLanguage: SupportedLanguage;
  faqs: WorkspaceFaqItem[];
  officeHours: string;
  agentBehaviorRules: string;
  greetingStyle: string;
  followUpStyle: string;
  updatedAt: string | null;
};

export type WorkspaceAISettingsInput = Omit<
  WorkspaceAISettings,
  "workspaceId" | "updatedAt"
>;

export const EMPTY_WORKSPACE_AI_SETTINGS: WorkspaceAISettingsInput = {
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
};
