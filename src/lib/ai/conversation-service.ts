import { generateAIReply } from "@/lib/ai/generate-reply";
import {
  createConversation,
  getConversationsByLead,
} from "@/lib/data/conversations";
import { getLeadById } from "@/lib/data/leads";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, ConversationSender } from "@/types/database";

export type SendWithAIResult = {
  userMessage: Conversation;
  aiMessage?: Conversation;
};

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

  const userMessage = await createConversation(supabase, {
    lead_id: leadId,
    message,
    sender,
  });

  const shouldGenerateAI = sender === "client";

  if (!shouldGenerateAI) {
    return { userMessage };
  }

  const history = await getConversationsByLead(supabase, leadId);
  const aiReply = await generateAIReply(lead, history);

  const aiMessage = await createConversation(supabase, {
    lead_id: leadId,
    message: aiReply,
    sender: "ai",
  });

  return { userMessage, aiMessage };
}
