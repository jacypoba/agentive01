import type { WorkspaceAISettings, WorkspaceFaqItem } from "@/lib/workspace-settings/types";

export type AiPreviewContextSignal = {
  configured: boolean;
  includedInPrompt: boolean;
  likelyUsedInReply: boolean;
  note?: string;
};

export type AiPreviewContextUsage = {
  companyInfo: AiPreviewContextSignal;
  faqs: AiPreviewContextSignal;
  officeHours: AiPreviewContextSignal;
  toneOfVoice: AiPreviewContextSignal;
  agentBehaviorRules: AiPreviewContextSignal;
};

const OFFICE_HOURS_QUESTION_PATTERN =
  /\b(hor[aá]rio|horarios|hours|open|aberto|fechado|funcionamento|when.*open|office hours|atendimento|dispon[ií]vel|disponibilidade)\b/i;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
}

function countTokenOverlap(source: string[], target: string[]): number {
  const targetSet = new Set(target);
  let matches = 0;
  for (const token of source) {
    if (targetSet.has(token)) {
      matches += 1;
    }
  }
  return matches;
}

function containsPhrase(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle).trim();
  if (!normalizedNeedle) {
    return false;
  }
  return normalizeText(haystack).includes(normalizedNeedle);
}

function findMatchedFaq(
  message: string,
  reply: string,
  faqs: WorkspaceFaqItem[]
): WorkspaceFaqItem | null {
  const messageTokens = tokenize(message);
  const replyTokens = tokenize(reply);

  for (const faq of faqs) {
    const questionTokens = tokenize(faq.question);
    const answerTokens = tokenize(faq.answer);

    if (
      questionTokens.length > 0 &&
      countTokenOverlap(messageTokens, questionTokens) >= 2
    ) {
      return faq;
    }

    if (
      answerTokens.length > 0 &&
      countTokenOverlap(replyTokens, answerTokens) >= 2
    ) {
      return faq;
    }

    if (containsPhrase(reply, faq.answer.slice(0, 40))) {
      return faq;
    }
  }

  return null;
}

function likelyUsedCompanyInfo(
  settings: WorkspaceAISettings,
  message: string,
  reply: string
): { used: boolean; note?: string } {
  if (settings.businessName && containsPhrase(reply, settings.businessName)) {
    return { used: true, note: `Mentions “${settings.businessName}”.` };
  }

  const infoTokens = tokenize(settings.businessInfo);
  if (
    infoTokens.length > 0 &&
    countTokenOverlap(tokenize(reply), infoTokens) >= 2
  ) {
    return { used: true, note: "Reply overlaps with business description." };
  }

  if (
    settings.businessInfo &&
    OFFICE_HOURS_QUESTION_PATTERN.test(message) === false &&
    countTokenOverlap(tokenize(message), tokenize(settings.businessInfo)) >= 2
  ) {
    return { used: true, note: "Lead message relates to business description." };
  }

  return { used: false };
}

function likelyUsedOfficeHours(
  settings: WorkspaceAISettings,
  message: string,
  reply: string
): { used: boolean; note?: string } {
  if (OFFICE_HOURS_QUESTION_PATTERN.test(message)) {
    if (
      containsPhrase(reply, settings.officeHours) ||
      countTokenOverlap(tokenize(reply), tokenize(settings.officeHours)) >= 2
    ) {
      return { used: true, note: "Lead asked about hours; reply references office hours." };
    }
    return {
      used: false,
      note: "Lead asked about hours, but reply did not clearly reference configured hours.",
    };
  }

  if (
    settings.officeHours &&
    (containsPhrase(reply, settings.officeHours) ||
      countTokenOverlap(tokenize(reply), tokenize(settings.officeHours)) >= 2)
  ) {
    return { used: true, note: "Reply references configured office hours." };
  }

  return { used: false };
}

function likelyUsedTone(settings: WorkspaceAISettings, reply: string): boolean {
  const toneTokens = tokenize(settings.toneOfVoice);
  if (toneTokens.length === 0) {
    return false;
  }
  return countTokenOverlap(tokenize(reply), toneTokens) >= 1;
}

function likelyUsedBehaviorRules(
  settings: WorkspaceAISettings,
  message: string,
  reply: string
): { used: boolean; note?: string } {
  const ruleTokens = tokenize(settings.agentBehaviorRules);
  if (ruleTokens.length === 0) {
    return { used: false };
  }

  const replyOverlap = countTokenOverlap(tokenize(reply), ruleTokens);
  const messageOverlap = countTokenOverlap(tokenize(message), ruleTokens);

  if (replyOverlap >= 2 || messageOverlap >= 2) {
    return { used: true, note: "Reply aligns with configured behavior rules." };
  }

  return { used: false };
}

export function analyzePreviewContextUsage(
  settings: WorkspaceAISettings,
  message: string,
  reply: string
): AiPreviewContextUsage {
  const companyConfigured = Boolean(
    settings.businessName.trim() || settings.businessInfo.trim()
  );
  const faqsConfigured = settings.faqs.length > 0;
  const officeConfigured = Boolean(settings.officeHours.trim());
  const toneConfigured = Boolean(settings.toneOfVoice.trim());
  const rulesConfigured = Boolean(settings.agentBehaviorRules.trim());

  const matchedFaq = faqsConfigured
    ? findMatchedFaq(message, reply, settings.faqs)
    : null;
  const companyUsage = companyConfigured
    ? likelyUsedCompanyInfo(settings, message, reply)
    : { used: false };
  const officeUsage = officeConfigured
    ? likelyUsedOfficeHours(settings, message, reply)
    : { used: false };
  const behaviorUsage = rulesConfigured
    ? likelyUsedBehaviorRules(settings, message, reply)
    : { used: false };

  return {
    companyInfo: {
      configured: companyConfigured,
      includedInPrompt: companyConfigured,
      likelyUsedInReply: companyUsage.used,
      note: companyUsage.note,
    },
    faqs: {
      configured: faqsConfigured,
      includedInPrompt: faqsConfigured,
      likelyUsedInReply: Boolean(matchedFaq),
      note: matchedFaq
        ? `Matched FAQ: “${matchedFaq.question}”`
        : faqsConfigured
          ? "No FAQ match detected in this exchange."
          : undefined,
    },
    officeHours: {
      configured: officeConfigured,
      includedInPrompt: officeConfigured,
      likelyUsedInReply: officeUsage.used,
      note: officeUsage.note,
    },
    toneOfVoice: {
      configured: toneConfigured,
      includedInPrompt: toneConfigured,
      likelyUsedInReply: toneConfigured ? likelyUsedTone(settings, reply) : false,
      note: toneConfigured
        ? "Tone is always injected into the system prompt when configured."
        : undefined,
    },
    agentBehaviorRules: {
      configured: rulesConfigured,
      includedInPrompt: rulesConfigured,
      likelyUsedInReply: behaviorUsage.used,
      note: behaviorUsage.note,
    },
  };
}
