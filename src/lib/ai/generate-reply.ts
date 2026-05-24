import OpenAI from "openai";
import { REAL_ESTATE_ASSISTANT_PROMPT } from "@/lib/ai/prompts";
import type { Conversation, Lead } from "@/types/database";

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

function buildLeadContext(lead: Lead): string {
  const parts = [`Client name: ${lead.client_name}`];
  if (lead.interest) parts.push(`Interest: ${lead.interest}`);
  if (lead.phone) parts.push(`Phone: ${lead.phone}`);
  parts.push(`Status: ${lead.status}`);
  return parts.join("\n");
}

function toOpenAIMessages(
  history: Conversation[],
  lead: Lead
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${REAL_ESTATE_ASSISTANT_PROMPT}\n\n---\nLead context:\n${buildLeadContext(lead)}`,
    },
  ];

  for (const item of history) {
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
  history: Conversation[]
): Promise<string> {
  const openai = getOpenAIClient();
  const messages = toOpenAIMessages(history, lead);

  const completion = await openai.chat.completions.create({
    model: getModel(),
    messages,
    temperature: 0.7,
    max_tokens: 300,
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("OpenAI returned an empty response.");
  }

  return reply;
}
