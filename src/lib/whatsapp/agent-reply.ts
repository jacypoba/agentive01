import { createConversation } from "@/lib/data/conversations";
import { sendWhatsAppTextSafe } from "@/lib/whatsapp/send";
import type { WhatsAppSendResult } from "@/lib/whatsapp/types";
import { resolveLeadPhoneDigits } from "@/lib/visits/whatsapp-notifications";
import type { ConversationSender } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Database, Lead } from "@/types/database";

type Client = SupabaseClient<Database>;

export type SendAgentWhatsAppReplyResult = {
  conversation: Conversation;
};

export type AgentWhatsAppReplyDeps = {
  sendWhatsAppTextSafe: (
    phoneDigits: string,
    text: string
  ) => Promise<WhatsAppSendResult>;
  createConversation: typeof createConversation;
};

const defaultDeps: AgentWhatsAppReplyDeps = {
  sendWhatsAppTextSafe,
  createConversation,
};

export function usesAgentWhatsAppOutbound(sender: ConversationSender): boolean {
  return sender === "agent";
}

export function isAcceptableAgentWhatsAppSendResult(
  result: WhatsAppSendResult
): boolean {
  return (
    result.success === true &&
    (result.sentToWhatsApp === true || result.pendingOnly === true)
  );
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

  const workspaceId = lead.workspace_id;
  if (!workspaceId) {
    throw new Error(
      "This lead is not associated with a workspace — WhatsApp was not sent."
    );
  }

  const sendResult = await deps.sendWhatsAppTextSafe(phoneDigits, trimmed);

  if (!isAcceptableAgentWhatsAppSendResult(sendResult)) {
    throw new Error(
      sendResult.error ??
        sendResult.warning ??
        "WhatsApp text send failed on all configured providers."
    );
  }

  if (sendResult.pendingOnly && !sendResult.sentToWhatsApp) {
    console.warn("[Agent reply] WhatsApp accepted with PENDING delivery status", {
      lead_id: lead.id,
      workspace_id: workspaceId,
      deliveryStatus: sendResult.deliveryStatus ?? null,
      warning: sendResult.warning ?? null,
    });
  }

  let authUserId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authUserId = user?.id ?? null;
  } catch {
    // diagnostic only
  }

  console.log("[Agent reply] Creating conversation row", {
    lead_id: lead.id,
    workspace_id: workspaceId,
    sender: "agent",
    authUserId,
  });

  const conversation = await deps.createConversation(supabase, {
    lead_id: lead.id,
    workspace_id: workspaceId,
    message: trimmed,
    sender: "agent",
  });

  console.log("[Agent reply] Conversation row created", {
    lead_id: lead.id,
    workspace_id: workspaceId,
    sender: "agent",
    authUserId,
    conversationId: conversation.id,
  });

  return { conversation };
}
