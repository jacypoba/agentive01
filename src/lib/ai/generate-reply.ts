import OpenAI from "openai";
import { dedupeAiReply } from "@/lib/ai/dedupe-reply";
import {
  finalizeWhatsAppText,
  wasCutByTokenLimit,
} from "@/lib/ai/complete-response";
import { MEMORY_MESSAGE_LIMIT } from "@/lib/ai/conversation-memory";
import type { MessageIntent } from "@/lib/ai/intent-classifier";
import { buildQualificationDirective } from "@/lib/ai/qualification";
import { REAL_ESTATE_ASSISTANT_PROMPT } from "@/lib/ai/prompts";
import {
  buildWorkspaceAssistantContext,
  type WorkspacePromptOptions,
} from "@/lib/ai/workspace-context";
import { LEAD_CONTEXT_LABELS } from "@/lib/i18n/messages";
import { enforceReplyLanguage } from "@/lib/i18n/language-purity";
import {
  buildStrictReplyLanguageDirective,
  getConsultantLanguageFallback,
  REPLY_LANGUAGE_CORRECTION,
  validateReplyLanguage,
} from "@/lib/i18n/reply-language";
import { resolveReplyLanguage } from "@/lib/i18n/sync-language";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { buildPropertyRecommendationDirective } from "@/lib/properties/recommendations";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import { buildAvailabilityDirective } from "@/lib/properties/property-availability";
import { getIntentStatusLabel } from "@/lib/leads/qualification-display";
import type { WorkspaceAISettings } from "@/lib/workspace-settings/types";
import type { Conversation, Lead, Property } from "@/types/database";

const DEFAULT_MODEL = "gpt-4.1-mini";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey });
}

function getModel() {
  return process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
}

function formatKnown(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function getLatestClientMessage(history: Conversation[]): string {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.sender === "client") {
      return history[index]?.message?.trim() ?? "";
    }
  }
  return "";
}

function isFirstAssistantReply(history: Conversation[]): boolean {
  return !history.some((item) => item.sender === "ai" || item.sender === "agent");
}

function resolveTurnLanguage(
  history: Conversation[],
  lead: Lead,
  languageOverride?: SupportedLanguage
): SupportedLanguage {
  if (languageOverride) {
    return languageOverride;
  }
  const latest = getLatestClientMessage(history);
  if (latest) {
    return resolveReplyLanguage(latest, lead);
  }
  return resolveReplyLanguage("", lead);
}

function buildLeadContext(lead: Lead, language: SupportedLanguage): string {
  const labels = LEAD_CONTEXT_LABELS[language];
  const parts = [`${labels.name}: ${lead.client_name}`];

  if (lead.interest && lead.interest !== "WhatsApp inquiry") {
    parts.push(`${labels.interest}: ${lead.interest}`);
  }
  if (lead.phone) {
    parts.push(`${labels.phone}: ${lead.phone}`);
  }

  parts.push(
    `${labels.status}: ${lead.status}`,
    `${labels.budget}: ${formatKnown(lead.budget)}`,
    `${labels.area}: ${formatKnown(lead.preferred_area)}`,
    `${labels.type}: ${formatKnown(lead.property_type)}`,
    `${labels.timeline}: ${formatKnown(lead.timeline)}`,
    `Intent status: ${getIntentStatusLabel(lead.intent_status ?? "unknown")}`,
    `${labels.visitHistory}: ${lead.visit_requested ? "yes" : "no"}`,
    `${labels.visitWhen}: ${formatKnown(lead.visit_datetime_text)}`,
    "",
    labels.memoryNote,
    "Do not assume old requests are still active. Do not invent schedules or confirmations.",
    "Use the client's name at most once every 3–4 messages when natural."
  );

  return parts.join("\n");
}

function buildConversationSummary(
  history: Conversation[],
  language: SupportedLanguage
): string {
  const labels = LEAD_CONTEXT_LABELS[language];
  if (history.length === 0) return labels.noHistory;

  return history
    .map((item) => {
      const role =
        item.sender === "client"
          ? labels.client
          : item.sender === "ai"
            ? labels.assistant
            : labels.agent;
      return `${role}: ${item.message}`;
    })
    .join("\n");
}

function buildSystemContent(
  history: Conversation[],
  lead: Lead,
  propertiesToRecommend: Property[],
  availability: PropertyAvailability,
  clientAskedForMore: boolean,
  clientAskedToReshow: boolean,
  messageIntent: MessageIntent,
  language: SupportedLanguage,
  workspaceSettings: WorkspaceAISettings | null,
  latestClientMessage: string
): string {
  const recentHistory = history.slice(-MEMORY_MESSAGE_LIMIT);
  const workspaceOptions: WorkspacePromptOptions = {
    replyLanguage: language,
    latestClientMessage,
    isFirstAssistantReply: isFirstAssistantReply(recentHistory),
  };

  const qualificationDirective = buildQualificationDirective(
    recentHistory,
    lead,
    {
      propertiesBeingSent: propertiesToRecommend,
      matchingPropertyCount: availability.matchingTotal,
      availability,
      clientAskedForMore,
      clientAskedToReshow,
      messageIntent,
      language,
    }
  );
  const propertyDirective = buildPropertyRecommendationDirective(
    propertiesToRecommend,
    availability
  );
  const availabilityDirective = buildAvailabilityDirective(
    availability,
    clientAskedForMore
  );

  const strictLanguage = buildStrictReplyLanguageDirective(
    language,
    latestClientMessage
  );
  const workspaceContext = buildWorkspaceAssistantContext(
    workspaceSettings,
    workspaceOptions
  );

  return [
    strictLanguage,
    "",
    "---",
    REAL_ESTATE_ASSISTANT_PROMPT,
    "",
    ...(workspaceContext ? ["---", workspaceContext, "---"] : []),
    `${LEAD_CONTEXT_LABELS[language].name.split(" ")[0]} profile (CRM):`,
    buildLeadContext(lead, language),
    "",
    "---",
    `Recent history (last ${recentHistory.length} messages):`,
    buildConversationSummary(recentHistory, language),
    "",
    qualificationDirective,
    "",
    propertyDirective,
    "",
    availabilityDirective,
    "",
    "---",
    strictLanguage,
  ].join("\n");
}

function toOpenAIMessages(
  history: Conversation[],
  lead: Lead,
  propertiesToRecommend: Property[],
  availability: PropertyAvailability,
  clientAskedForMore: boolean,
  clientAskedToReshow = false,
  messageIntent: MessageIntent = "unknown",
  language: SupportedLanguage = "pt",
  workspaceSettings: WorkspaceAISettings | null = null
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const recentHistory = history.slice(-MEMORY_MESSAGE_LIMIT);
  const latestClientMessage = getLatestClientMessage(recentHistory);

  const systemContent = buildSystemContent(
    history,
    lead,
    propertiesToRecommend,
    availability,
    clientAskedForMore,
    clientAskedToReshow,
    messageIntent,
    language,
    workspaceSettings,
    latestClientMessage
  );

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
  ];

  for (const item of recentHistory) {
    if (item.sender === "client") {
      messages.push({ role: "user", content: item.message });
    } else {
      messages.push({ role: "assistant", content: item.message });
    }
  }

  return messages;
}

function polishReply(
  rawReply: string,
  history: Conversation[],
  language: SupportedLanguage,
  leadId: string
): string {
  const deduped = dedupeAiReply(rawReply, history);
  if (!deduped) {
    return "";
  }

  const finalized = finalizeWhatsAppText(deduped);
  if (!finalized) {
    console.warn("[AI reply] Incomplete reply discarded", {
      leadId,
      preview: deduped.slice(0, 80),
    });
    return "";
  }

  const validation = validateReplyLanguage(finalized, language);
  if (validation.valid) {
    return finalized;
  }

  const enforced = enforceReplyLanguage(finalized, language);
  if (enforced.adjusted) {
    console.warn("[AI reply] Language/style correction applied", {
      leadId,
      reason: enforced.reason ?? validation.reason,
      preview: finalized.slice(0, 80),
    });
  }

  return enforced.text;
}

async function callModel(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  leadId: string
): Promise<string> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: getModel(),
    messages,
    temperature: 0.78,
    max_tokens: 120,
    presence_penalty: 0.55,
    frequency_penalty: 0.65,
  });

  const choice = completion.choices[0];
  const reply = choice?.message?.content?.trim();
  if (!reply) {
    throw new Error("OpenAI returned an empty response.");
  }

  if (wasCutByTokenLimit(choice?.finish_reason)) {
    console.warn("[AI reply] Model output hit token limit", {
      leadId,
      preview: reply.slice(0, 80),
    });
    return "";
  }

  return reply;
}

export async function generateAIReply(
  lead: Lead,
  history: Conversation[],
  propertiesToRecommend: Property[] = [],
  availability: PropertyAvailability,
  clientAskedForMore = false,
  clientAskedToReshow = false,
  messageIntent: MessageIntent = "unknown",
  languageOverride?: SupportedLanguage,
  workspaceSettings: WorkspaceAISettings | null = null
): Promise<string> {
  const language = resolveTurnLanguage(history, lead, languageOverride);
  const messages = toOpenAIMessages(
    history,
    lead,
    propertiesToRecommend,
    availability,
    clientAskedForMore,
    clientAskedToReshow,
    messageIntent,
    language,
    workspaceSettings
  );

  let rawReply = await callModel(messages, lead.id);
  let polished = polishReply(rawReply, history, language, lead.id);

  if (!polished && rawReply) {
    polished = getConsultantLanguageFallback(language);
  }

  if (polished && !validateReplyLanguage(polished, language).valid) {
    const retryMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...messages,
      { role: "assistant", content: rawReply },
      { role: "user", content: REPLY_LANGUAGE_CORRECTION[language] },
    ];

    rawReply = await callModel(retryMessages, lead.id);
    polished = polishReply(rawReply, history, language, lead.id);
  }

  if (!polished || !validateReplyLanguage(polished, language).valid) {
    return getConsultantLanguageFallback(language);
  }

  return polished;
}
