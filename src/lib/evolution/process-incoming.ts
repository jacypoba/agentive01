import { processClientMessageWithAI } from "@/lib/ai/conversation-service";
import {
  sendOutboundWhatsAppMessages,
  type OutboundSendReport,
} from "@/lib/properties/send-whatsapp";
import type { ParsedIncomingMessage } from "@/lib/whatsapp/types";
import { createLead, getLeadByPhone } from "@/lib/data/leads";
import { formatPhoneDisplay } from "@/lib/phone/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Conversation, Lead } from "@/types/database";

export type ProcessIncomingResult = {
  lead: Lead;
  clientMessage: Conversation;
  aiMessage?: Conversation;
  aiMessages?: Conversation[];
  whatsappSent: boolean;
  whatsappReport: OutboundSendReport | null;
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

  const {
    userMessage,
    aiMessage,
    aiMessages,
    outboundMessages,
    lead: updatedLead,
  } = await processClientMessageWithAI(supabase, lead, incoming.text);

  let whatsappReport: OutboundSendReport | null = null;
  let whatsappSent = false;

  if (outboundMessages.length > 0) {
    try {
      whatsappReport = await sendOutboundWhatsAppMessages(
        incoming.phoneDigits,
        outboundMessages,
        incoming.instance,
        incoming.remoteJid
      );
      whatsappSent = whatsappReport.sent > 0;

      if (whatsappReport.failed > 0) {
        console.warn("[WhatsApp inbound] Outbound completed with failures", {
          leadId: updatedLead.id,
          messageId: incoming.messageId,
          report: whatsappReport,
        });
      }
    } catch (error) {
      console.error("[WhatsApp inbound] Unexpected outbound error", {
        leadId: updatedLead.id,
        messageId: incoming.messageId,
        error: error instanceof Error ? error.message : error,
      });
      whatsappReport = {
        attempted: outboundMessages.length,
        sent: 0,
        failed: outboundMessages.length,
        failures: [
          {
            kind: "text",
            error:
              error instanceof Error
                ? error.message
                : "Unexpected outbound delivery error.",
          },
        ],
      };
    }
  }

  return {
    lead: updatedLead,
    clientMessage: userMessage,
    aiMessage,
    aiMessages,
    whatsappSent,
    whatsappReport,
    isNewLead,
  };
}
