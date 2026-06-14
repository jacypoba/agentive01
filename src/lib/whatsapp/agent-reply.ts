import { createConversation } from "@/lib/data/conversations";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { resolveLeadPhoneDigits } from "@/lib/visits/whatsapp-notifications";
import type { ConversationSender } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Database, Lead } from "@/types/database";

type Client = SupabaseClient<Database>;

export type SendAgentWhatsAppReplyResult = {
  conversation: Conversation;
};

export type AgentWhatsAppReplyDeps = {
  sendWhatsAppText: (
    phoneDigits: string,
    text: string
  ) => Promise<{ success: boolean; status?: number }>;
  createConversation: typeof createConversation;
};

const defaultDeps: AgentWhatsAppReplyDeps = {
  sendWhatsAppText,
  createConversation,
};

export function usesAgentWhatsAppOutbound(sender: ConversationSender): boolean {
  return sender === "agent";
}

export async function sendAgentWhatsAppReply(
  supabase: Client,
  lead: Lead,
  message: string,
  deps: AgentWhatsAppReplyDeps = defaultDeps
): Promise<SendAgentWhatsAppReplyResult> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty.");
  }

  const phoneDigits = resolveLeadPhoneDigits(lead);
  if (!phoneDigits) {
    throw new Error("This lead has no phone number — WhatsApp was not sent.");
  }

  await deps.sendWhatsAppText(phoneDigits, trimmed);

  const conversation = await deps.createConversation(supabase, {
    lead_id: lead.id,
    message: trimmed,
    sender: "agent",
  });

  return { conversation };
}
