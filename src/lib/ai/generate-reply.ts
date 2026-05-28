import OpenAI from "openai";
import { dedupeAiReply } from "@/lib/ai/dedupe-reply";
import { MEMORY_MESSAGE_LIMIT } from "@/lib/ai/conversation-memory";
import type { MessageIntent } from "@/lib/ai/intent-classifier";
import { buildQualificationDirective } from "@/lib/ai/qualification";
import { REAL_ESTATE_ASSISTANT_PROMPT } from "@/lib/ai/prompts";
import {
  AI_LANGUAGE_INSTRUCTION,
  LEAD_CONTEXT_LABELS,
} from "@/lib/i18n/messages";
import { enforceReplyLanguage } from "@/lib/i18n/language-purity";
import { getLeadLanguage } from "@/lib/i18n/sync-language";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { buildPropertyRecommendationDirective } from "@/lib/properties/recommendations";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import { buildAvailabilityDirective } from "@/lib/properties/property-availability";
import { getIntentStatusLabel } from "@/lib/leads/qualification-display";
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

function toOpenAIMessages(
  history: Conversation[],
  lead: Lead,
  propertiesToRecommend: Property[],
  availability: PropertyAvailability,
  clientAskedForMore: boolean,
  clientAskedToReshow = false,
  messageIntent: MessageIntent = "unknown",
  language: SupportedLanguage = "pt"
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const recentHistory = history.slice(-MEMORY_MESSAGE_LIMIT);
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

  const systemContent = [
    REAL_ESTATE_ASSISTANT_PROMPT,
    "",
    "---",
    AI_LANGUAGE_INSTRUCTION[language],
    "",
    "---",
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
  ].join("\n");

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

export async function generateAIReply(
  lead: Lead,
  history: Conversation[],
  propertiesToRecommend: Property[] = [],
  availability: PropertyAvailability,
  clientAskedForMore = false,
  clientAskedToReshow = false,
  messageIntent: MessageIntent = "unknown",
  languageOverride?: SupportedLanguage
): Promise<string> {
  const language = languageOverride ?? getLeadLanguage(lead);
  const openai = getOpenAIClient();
  const messages = toOpenAIMessages(
    history,
    lead,
    propertiesToRecommend,
    availability,
    clientAskedForMore,
    clientAskedToReshow,
    messageIntent,
    language
  );

  const completion = await openai.chat.completions.create({
    model: getModel(),
    messages,
    temperature: 0.78,
    max_tokens: 100,
    presence_penalty: 0.55,
    frequency_penalty: 0.65,
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("OpenAI returned an empty response.");
  }

  const deduped = dedupeAiReply(reply, history);
  return enforceReplyLanguage(deduped, language).text;
}
