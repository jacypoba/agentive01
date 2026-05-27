import { extractAndApplyLeadQualification } from "@/lib/ai/apply-qualification";
import { loadConversationMemory } from "@/lib/ai/conversation-memory";
import { generateAIReply } from "@/lib/ai/generate-reply";
import { generateCatalogComparison } from "@/lib/ai/generate-catalog-comparison";
import {
  clientAskedForMoreOptions,
  clientAskedToSeeOptions,
} from "@/lib/ai/qualification";
import {
  createConversation,
  getConversationsByLead,
} from "@/lib/data/conversations";
import { findPropertyRecommendations } from "@/lib/properties/find-recommendations";
import { analyzePropertyAvailability } from "@/lib/properties/property-availability";
import {
  buildPropertyFollowUpText,
  formatPropertyCard,
  formatPropertyListingRecord,
  getShownPropertyIds,
  isCatalogBatch,
} from "@/lib/properties/property-cards";
import {
  buildCatalogOutboundMessages,
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
  recommendedProperties?: Property[];
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

async function persistPropertyRecommendation(
  supabase: Client,
  leadId: string,
  property: Property
): Promise<Conversation[]> {
  const saved: Conversation[] = [];
  const detailsText = formatPropertyCard(property);

  saved.push(await saveAiMessage(supabase, leadId, detailsText));

  const listingRecord = formatPropertyListingRecord(property);
  if (listingRecord) {
    saved.push(await saveAiMessage(supabase, leadId, listingRecord));
  } else {
    saved.push(
      await saveAiMessage(supabase, leadId, `[property:${property.id}]`)
    );
  }

  return saved;
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

  const clientAskedForMore = clientAskedForMoreOptions(history);
  const clientAskedForOptions = clientAskedToSeeOptions(history);

  const { properties: matchingProperties, criteria } =
    await findPropertyRecommendations(supabase, memoryLead, history, 20);

  const availability = analyzePropertyAvailability(
    matchingProperties,
    history,
    criteria != null
  );
  const propertiesToRecommend = availability.toSend;

  console.log("[WhatsApp debug] Search criteria:", criteria);
  console.log("[WhatsApp debug] Matching properties count:", availability.matchingTotal);
  console.log("[WhatsApp debug] Shown property IDs:", [...getShownPropertyIds(history)]);
  console.log("[WhatsApp debug] Remaining unsent:", availability.remainingCount);
  console.log("[WhatsApp debug] Sending this turn:", propertiesToRecommend.map((p) => p.title));

  const aiReply = await generateAIReply(
    memoryLead,
    history,
    propertiesToRecommend,
    availability,
    clientAskedForMore
  );

  const aiMessages: Conversation[] = [];
  const outboundMessages: OutboundWhatsAppMessage[] = [];

  const introMessage = await saveAiMessage(supabase, lead.id, aiReply);
  aiMessages.push(introMessage);
  outboundMessages.push({ kind: "text", text: aiReply });

  if (isCatalogBatch(propertiesToRecommend)) {
    const detailsTexts = propertiesToRecommend.map((property) =>
      formatPropertyCard(property)
    );

    for (const property of propertiesToRecommend) {
      const propertyMessages = await persistPropertyRecommendation(
        supabase,
        lead.id,
        property
      );
      aiMessages.push(...propertyMessages);
    }

    outboundMessages.push(
      ...buildCatalogOutboundMessages(propertiesToRecommend, detailsTexts)
    );

    const closingText = await generateCatalogComparison(
      memoryLead,
      history,
      propertiesToRecommend
    );
    if (closingText) {
      const closingMessage = await saveAiMessage(
        supabase,
        lead.id,
        closingText
      );
      aiMessages.push(closingMessage);
      outboundMessages.push({ kind: "text", text: closingText });
    }
  } else if (propertiesToRecommend.length === 1) {
    const property = propertiesToRecommend[0];
    const detailsText = formatPropertyCard(property);

    const propertyMessages = await persistPropertyRecommendation(
      supabase,
      lead.id,
      property
    );
    aiMessages.push(...propertyMessages);

    outboundMessages.push(
      ...buildPropertyOutboundMessages(property, detailsText)
    );

    const followUpText = buildPropertyFollowUpText({
      hasMoreMatches: availability.remainingAfterSend > 0,
      clientAskedForOptions,
    });

    if (followUpText) {
      const followUpMessage = await saveAiMessage(
        supabase,
        lead.id,
        followUpText
      );
      aiMessages.push(followUpMessage);
      outboundMessages.push({ kind: "text", text: followUpText });
    }
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
    recommendedProperty: propertiesToRecommend[0],
    recommendedProperties:
      propertiesToRecommend.length > 0 ? propertiesToRecommend : undefined,
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
