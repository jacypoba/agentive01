import OpenAI from "openai";
import { MEMORY_MESSAGE_LIMIT } from "@/lib/ai/conversation-memory";
import { buildQualificationDirective } from "@/lib/ai/qualification";
import { REAL_ESTATE_ASSISTANT_PROMPT } from "@/lib/ai/prompts";
import { getIntentStatusLabel } from "@/lib/leads/qualification-display";
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

function formatKnown(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "desconhecido";
}

function buildLeadContext(lead: Lead): string {
  const parts = [`Nome do cliente: ${lead.client_name}`];

  if (lead.interest && lead.interest !== "WhatsApp inquiry") {
    parts.push(`Interesse inicial: ${lead.interest}`);
  }
  if (lead.phone) {
    parts.push(`Telefone: ${lead.phone}`);
  }

  parts.push(
    `Estado do lead: ${lead.status}`,
    `Orçamento: ${formatKnown(lead.budget)}`,
    `Zona preferida: ${formatKnown(lead.preferred_area)}`,
    `Tipo de imóvel: ${formatKnown(lead.property_type)}`,
    `Prazo: ${formatKnown(lead.timeline)}`,
    `Intent status: ${getIntentStatusLabel(lead.intent_status ?? "unknown")}`,
    `Pedido de visita: ${lead.visit_requested ? "sim" : "não"}`,
    `Data/hora visita (texto): ${formatKnown(lead.visit_datetime_text)}`,
    "",
    "Memória persistente: use estes dados guardados no CRM. Não volte a perguntar o que já está preenchido — continue a conversa a partir daqui."
  );

  return parts.join("\n");
}

function buildConversationSummary(history: Conversation[]): string {
  if (history.length === 0) return "Nenhuma mensagem anterior.";

  return history
    .map((item) => {
      const role =
        item.sender === "client"
          ? "Cliente"
          : item.sender === "ai"
            ? "Assistente"
            : "Consultor";
      return `${role}: ${item.message}`;
    })
    .join("\n");
}

function toOpenAIMessages(
  history: Conversation[],
  lead: Lead
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const recentHistory = history.slice(-MEMORY_MESSAGE_LIMIT);
  const qualificationDirective = buildQualificationDirective(recentHistory, lead);

  const systemContent = [
    REAL_ESTATE_ASSISTANT_PROMPT,
    "",
    "---",
    "Perfil do lead (CRM — memória persistente):",
    buildLeadContext(lead),
    "",
    "---",
    `Histórico recente (últimas ${recentHistory.length} mensagens):`,
    buildConversationSummary(recentHistory),
    "",
    qualificationDirective,
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
  history: Conversation[]
): Promise<string> {
  const openai = getOpenAIClient();
  const messages = toOpenAIMessages(history, lead);

  const completion = await openai.chat.completions.create({
    model: getModel(),
    messages,
    temperature: 0.78,
    max_tokens: 180,
    presence_penalty: 0.45,
    frequency_penalty: 0.55,
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("OpenAI returned an empty response.");
  }

  return reply;
}
