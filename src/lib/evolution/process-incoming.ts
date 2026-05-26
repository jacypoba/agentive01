import { processClientMessageWithAI } from "@/lib/ai/conversation-service";
import { sendWhatsAppText } from "@/lib/evolution/client";
import type { ParsedIncomingMessage } from "@/lib/evolution/types";
import { createLead, getLeadByPhone } from "@/lib/data/leads";
import { formatPhoneDisplay } from "@/lib/phone/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Conversation, Lead } from "@/types/database";

export type ProcessIncomingResult = {
  lead: Lead;
  clientMessage: Conversation;
  aiMessage?: Conversation;
  whatsappSent: boolean;
  isNewLead: boolean;
};

function getDefaultUserId(): string {
  const userId = process.env.WHATSAPP_DEFAULT_USER_ID;
  if (!userId) {
    throw new Error("WHATSAPP_DEFAULT_USER_ID is not configured.");
  }
  return userId;
}

export async function processIncomingWhatsAppMessage(
  incoming: ParsedIncomingMessage
): Promise<ProcessIncomingResult> {
  const userId = getDefaultUserId();
  const supabase = createAdminClient();

  let lead = await getLeadByPhone(supabase, userId, incoming.phoneDigits);
  let isNewLead = false;

  if (!lead) {
    isNewLead = true;
    lead = await createLead(supabase, {
      user_id: userId,
      client_name: incoming.pushName,
      phone: formatPhoneDisplay(incoming.phoneDigits),
      phone_normalized: incoming.phoneDigits,
      interest: "WhatsApp inquiry",
      status: "new",
    });
  }

  const { userMessage, aiMessage, lead: updatedLead } =
    await processClientMessageWithAI(supabase, lead, incoming.text);

  let whatsappSent = false;

  if (aiMessage) {
    await sendWhatsAppText(
      incoming.phoneDigits,
      aiMessage.message,
      incoming.instance
    );
    whatsappSent = true;
  }

  return {
    lead: updatedLead,
    clientMessage: userMessage,
    aiMessage,
    whatsappSent,
    isNewLead,
  };
}
