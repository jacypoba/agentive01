import { generateAIReply } from "@/lib/ai/generate-reply";
import {
  createConversation,
  getConversationsByLead,
} from "@/lib/data/conversations";
import { getLeadById } from "@/lib/data/leads";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  ConversationSender,
  Database,
  Lead,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export type SendWithAIResult = {
  userMessage: Conversation;
  aiMessage?: Conversation;
};

/** Core flow: save client message → generate AI reply → save AI message. */
export async function processClientMessageWithAI(
  supabase: Client,
  lead: Lead,
  message: string
): Promise<SendWithAIResult> {
  const userMessage = await createConversation(supabase, {
    lead_id: lead.id,
    message,
    sender: "client",
  });

  const history = await getConversationsByLead(supabase, lead.id);
  const aiReply = await generateAIReply(lead, history);

  const aiMessage = await createConversation(supabase, {
    lead_id: lead.id,
    message: aiReply,
    sender: "ai",
  });

  return { userMessage, aiMessage };
}

export async function sendMessageWithAI(
  leadId: string,
  message: string,
  sender: ConversationSender
): Promise<SendWithAIResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const lead = await getLeadById(supabase, user.id, leadId);
  if (!lead) {
    throw new Error("Lead not found");
  }

  if (sender === "client") {
    return processClientMessageWithAI(supabase, lead, message);
  }

  const userMessage = await createConversation(supabase, {
    lead_id: leadId,
    message,
    sender,
  });

  return { userMessage };
}
