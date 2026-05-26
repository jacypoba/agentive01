import { extractAndApplyLeadQualification } from "@/lib/ai/apply-qualification";
import { loadConversationMemory } from "@/lib/ai/conversation-memory";
import { generateAIReply } from "@/lib/ai/generate-reply";
import {
  createConversation,
  getConversationsByLead,
} from "@/lib/data/conversations";
import { findPropertyRecommendations } from "@/lib/properties/find-recommendations";
import { derivePropertySearchCriteria } from "@/lib/properties/search-criteria";
import {
  buildPropertyFollowUpText,
  formatPropertyCard,
  formatPropertyDetails,
  formatPropertyImageConversationRecord,
  hasPropertyImage,
  selectNextPropertyToRecommend,
} from "@/lib/properties/property-cards";
import {
  buildPropertyOutboundMessages,
  type OutboundWhatsAppMessage,
} from "@/lib/properties/send-whatsapp";
import { getLeadById } from "@/lib/data/leads";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  ConversationSender,
  Database,
  Lead,
  Property,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export type SendWithAIResult = {
  userMessage: Conversation;
  aiMessage?: Conversation;
  aiMessages: Conversation[];
  outboundMessages: OutboundWhatsAppMessage[];
  recommendedProperty?: Property;
  lead: Lead;
};

async function saveAiMessage(
  supabase: Client,
  leadId: string,
  message: string
): Promise<Conversation> {
  return createConversation(supabase, {
    lead_id: leadId,
    message,
    sender: "ai",
  });
}

/** Core flow: save client message → generate AI reply → save AI message → extract qualification. */
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

  const { lead: memoryLead, history } = await loadConversationMemory(
    supabase,
    lead
  );

  const criteria = derivePropertySearchCriteria(memoryLead, history);
  console.log("[WhatsApp debug] Extracted criteria:", criteria);

  const matchingProperties = await findPropertyRecommendations(
    supabase,
    memoryLead,
    history,
    10
  );
  console.log(
    "[WhatsApp debug] Matching properties count:",
    matchingProperties.length
  );
  console.log(
    "[WhatsApp debug] Matching property titles:",
    matchingProperties.map((property) => property.title)
  );

  const propertyToRecommend = selectNextPropertyToRecommend(
    matchingProperties,
    history
  );
  console.log(
    "[WhatsApp debug] Selected property title:",
    propertyToRecommend?.title ?? null
  );

  const aiReply = await generateAIReply(
    memoryLead,
    history,
    propertyToRecommend
  );

  const aiMessages: Conversation[] = [];
  const outboundMessages: OutboundWhatsAppMessage[] = [];

  const introMessage = await saveAiMessage(supabase, lead.id, aiReply);
  aiMessages.push(introMessage);
  outboundMessages.push({ kind: "text", text: aiReply });

  if (propertyToRecommend) {
    const detailsText = hasPropertyImage(propertyToRecommend)
      ? formatPropertyDetails(propertyToRecommend)
      : formatPropertyCard(propertyToRecommend);

    if (hasPropertyImage(propertyToRecommend)) {
      const imageRecord = formatPropertyImageConversationRecord(
        propertyToRecommend
      );
      const imageMessage = await saveAiMessage(supabase, lead.id, imageRecord);
      aiMessages.push(imageMessage);
    }

    const detailsMessage = await saveAiMessage(supabase, lead.id, detailsText);
    aiMessages.push(detailsMessage);

    outboundMessages.push(
      ...buildPropertyOutboundMessages(propertyToRecommend, detailsText)
    );

    const followUpText = buildPropertyFollowUpText();
    const followUpMessage = await saveAiMessage(
      supabase,
      lead.id,
      followUpText
    );
    aiMessages.push(followUpMessage);
    outboundMessages.push({ kind: "text", text: followUpText });
  }

  console.log(
    "[WhatsApp debug] Outbound message kinds:",
    outboundMessages.map((message) => message.kind)
  );

  const fullHistory = await getConversationsByLead(supabase, lead.id);
  const updatedLead = await extractAndApplyLeadQualification(
    supabase,
    lead,
    fullHistory
  );

  return {
    userMessage,
    aiMessage: aiMessages[0],
    aiMessages,
    outboundMessages,
    recommendedProperty: propertyToRecommend ?? undefined,
    lead: updatedLead,
  };
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

  return {
    userMessage,
    aiMessages: [],
    outboundMessages: [],
    lead,
  };
}
