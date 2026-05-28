import { extractAndApplyLeadQualification } from "@/lib/ai/apply-qualification";
import { loadConversationMemory } from "@/lib/ai/conversation-memory";
import {
  dedupeAiReply,
  EXHAUSTED_MATCH_LINES,
  normalizeForDedupe,
  pickUnusedVariant,
} from "@/lib/ai/dedupe-reply";
import {
  buildClosingReply,
  logIntentDecision,
  sanitizeGuardedReply,
} from "@/lib/ai/guardrails";
import { generateAIReply } from "@/lib/ai/generate-reply";
import { generateCatalogComparison } from "@/lib/ai/generate-catalog-comparison";
import {
  classifyMessageIntent,
  shouldQueryProperties,
  shouldRunFreshPropertyQuery,
  shouldUseReshowBatch,
} from "@/lib/ai/intent-classifier";
import { clientAskedForMoreOptions } from "@/lib/ai/qualification";
import {
  createConversation,
  getConversationsByLead,
} from "@/lib/data/conversations";
import { getPropertiesByIds } from "@/lib/data/properties";
import { cancelFollowUpsOnClientReply } from "@/lib/follow-ups/scheduler";
import { findPropertyRecommendations } from "@/lib/properties/find-recommendations";
import {
  analyzePropertyAvailability,
  buildReshowAvailability,
  type PropertyAvailability,
} from "@/lib/properties/property-availability";
import {
  buildReshowIntroText,
  formatPropertyCard,
  formatPropertyListingRecord,
  getLastShownPropertyBatchIds,
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

const EMPTY_AVAILABILITY: PropertyAvailability = {
  matchingTotal: 0,
  shownCount: 0,
  remainingCount: 0,
  toSend: [],
  remainingAfterSend: 0,
  allShown: false,
  noMatchesInDatabase: false,
  criteriaMissing: true,
  isReshow: false,
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

function prepareUniqueAiText(
  text: string,
  history: Conversation[],
  seenThisTurn: Set<string>
): string | null {
  const deduped = dedupeAiReply(text, history).trim();
  if (!deduped) {
    return null;
  }

  const normalized = normalizeForDedupe(deduped);
  if (seenThisTurn.has(normalized)) {
    return null;
  }

  seenThisTurn.add(normalized);
  return deduped;
}

async function appendUniqueTextReply(
  supabase: Client,
  leadId: string,
  history: Conversation[],
  seenThisTurn: Set<string>,
  text: string,
  aiMessages: Conversation[],
  outboundMessages: OutboundWhatsAppMessage[],
  guard?: {
    intent: ReturnType<typeof classifyMessageIntent>["intent"];
    freshQueryMade: boolean;
    propertiesSent: boolean;
  }
): Promise<void> {
  let candidate = text;

  if (guard) {
    const sanitized = sanitizeGuardedReply(candidate, history, guard);
    if (!sanitized) {
      console.log("[WhatsApp guardrails] Blocked reply", {
        leadId,
        intent: guard.intent,
        preview: candidate.slice(0, 80),
      });
      return;
    }
    candidate = sanitized;
  }

  const unique = prepareUniqueAiText(candidate, history, seenThisTurn);
  if (!unique) {
    console.log("[WhatsApp guardrails] Skipped duplicate reply", { leadId });
    return;
  }

  const saved = await saveAiMessage(supabase, leadId, unique);
  aiMessages.push(saved);
  outboundMessages.push({ kind: "text", text: unique });
}

async function resolvePropertiesToRecommend(
  supabase: Client,
  memoryLead: Lead,
  history: Conversation[],
  classified: ReturnType<typeof classifyMessageIntent>
) {
  const freshQuery = shouldRunFreshPropertyQuery(classified);
  const useReshow = shouldUseReshowBatch(classified);

  const { properties: matchingProperties, criteria } =
    await findPropertyRecommendations(supabase, memoryLead, history, 20, {
      preferLatestMessage: freshQuery,
    });

  if (useReshow) {
    const lastBatchIds = getLastShownPropertyBatchIds(history);
    if (lastBatchIds.length > 0) {
      const reshown = await getPropertiesByIds(
        supabase,
        memoryLead.user_id,
        lastBatchIds
      );

      if (reshown.length > 0) {
        return {
          propertiesToRecommend: reshown,
          availability: buildReshowAvailability(
            reshown,
            matchingProperties,
            history,
            criteria != null
          ),
          criteria,
          isReshow: true,
          freshQueryMade: false,
        };
      }
    }
  }

  const availability = analyzePropertyAvailability(
    matchingProperties,
    history,
    criteria != null
  );

  return {
    propertiesToRecommend: availability.toSend,
    availability,
    criteria,
    isReshow: false,
    freshQueryMade: freshQuery && criteria != null,
  };
}

async function buildIntroReply(
  memoryLead: Lead,
  history: Conversation[],
  propertiesToRecommend: Property[],
  availability: PropertyAvailability,
  classified: ReturnType<typeof classifyMessageIntent>,
  isReshow: boolean,
  freshQueryMade: boolean
): Promise<string> {
  if (isReshow && propertiesToRecommend.length > 0) {
    return buildReshowIntroText(
      `${memoryLead.id}:${propertiesToRecommend.map((item) => item.id).join(",")}`,
      propertiesToRecommend.length
    );
  }

  if (
    propertiesToRecommend.length === 0 &&
    availability.allShown &&
    classified.intent === "ask_more_options" &&
    freshQueryMade
  ) {
    return pickUnusedVariant(
      EXHAUSTED_MATCH_LINES,
      history,
      `${memoryLead.id}:exhausted`
    );
  }

  return generateAIReply(
    memoryLead,
    history,
    propertiesToRecommend,
    availability,
    clientAskedForMoreOptions(history),
    isReshow,
    classified.intent
  );
}

async function finalizeLead(
  supabase: Client,
  lead: Lead,
  history: Conversation[]
): Promise<Lead> {
  const fullHistory = await getConversationsByLead(supabase, lead.id);
  return extractAndApplyLeadQualification(supabase, lead, fullHistory);
}

/** Core flow: save client message → classify intent → guarded reply → qualification. */
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

  await cancelFollowUpsOnClientReply(supabase, lead.id);

  const { lead: memoryLead, history } = await loadConversationMemory(
    supabase,
    lead
  );

  const classified = classifyMessageIntent(history, memoryLead);
  logIntentDecision(lead.id, classified);

  const aiMessages: Conversation[] = [];
  const outboundMessages: OutboundWhatsAppMessage[] = [];
  const seenThisTurn = new Set<string>();

  if (classified.intent === "thanks_or_closing") {
    const closing = buildClosingReply(memoryLead, history);
    if (closing) {
      await appendUniqueTextReply(
        supabase,
        lead.id,
        history,
        seenThisTurn,
        closing,
        aiMessages,
        outboundMessages,
        {
          intent: classified.intent,
          freshQueryMade: false,
          propertiesSent: false,
        }
      );
    } else {
      console.log("[WhatsApp guardrails] Thanks/closing — no second closing sent", {
        leadId: lead.id,
      });
    }

    const updatedLead = await finalizeLead(supabase, lead, history);

    return {
      userMessage,
      aiMessage: aiMessages[0],
      aiMessages,
      outboundMessages,
      lead: updatedLead,
    };
  }

  let propertiesToRecommend: Property[] = [];
  let availability = EMPTY_AVAILABILITY;
  let criteria = null;
  let isReshow = false;
  let freshQueryMade = false;

  if (shouldQueryProperties(classified)) {
    const resolved = await resolvePropertiesToRecommend(
      supabase,
      memoryLead,
      history,
      classified
    );
    propertiesToRecommend = resolved.propertiesToRecommend;
    availability = resolved.availability;
    criteria = resolved.criteria;
    isReshow = resolved.isReshow;
    freshQueryMade = resolved.freshQueryMade;

    console.log("[WhatsApp debug] Search criteria:", criteria);
    console.log("[WhatsApp debug] Matching properties count:", availability.matchingTotal);
    console.log("[WhatsApp debug] Shown property IDs:", [...getShownPropertyIds(history)]);
    console.log("[WhatsApp debug] Remaining unsent:", availability.remainingCount);
    console.log("[WhatsApp debug] Re-show:", isReshow);
    console.log("[WhatsApp debug] Fresh query:", freshQueryMade);
    console.log(
      "[WhatsApp debug] Sending this turn:",
      propertiesToRecommend.map((p) => p.title)
    );
  }

  const guardContext = {
    intent: classified.intent,
    freshQueryMade,
    propertiesSent: propertiesToRecommend.length > 0,
  };

  const aiReply = await buildIntroReply(
    memoryLead,
    history,
    propertiesToRecommend,
    availability,
    classified,
    isReshow,
    freshQueryMade
  );

  if (aiReply) {
    await appendUniqueTextReply(
      supabase,
      lead.id,
      history,
      seenThisTurn,
      aiReply,
      aiMessages,
      outboundMessages,
      guardContext
    );
  }

  if (isCatalogBatch(propertiesToRecommend)) {
    const detailsTexts = propertiesToRecommend.map((property) =>
      formatPropertyCard(property)
    );

    if (!isReshow) {
      for (const property of propertiesToRecommend) {
        const propertyMessages = await persistPropertyRecommendation(
          supabase,
          lead.id,
          property
        );
        aiMessages.push(...propertyMessages);
      }
    }

    outboundMessages.push(
      ...buildCatalogOutboundMessages(propertiesToRecommend, detailsTexts)
    );

    if (!isReshow) {
      const closingText = await generateCatalogComparison(
        memoryLead,
        history,
        propertiesToRecommend
      );
      if (closingText) {
        await appendUniqueTextReply(
          supabase,
          lead.id,
          history,
          seenThisTurn,
          closingText,
          aiMessages,
          outboundMessages,
          guardContext
        );
      }
    }
  } else if (propertiesToRecommend.length === 1) {
    const property = propertiesToRecommend[0];
    const detailsText = formatPropertyCard(property);

    if (!isReshow) {
      const propertyMessages = await persistPropertyRecommendation(
        supabase,
        lead.id,
        property
      );
      aiMessages.push(...propertyMessages);
    }

    outboundMessages.push(
      ...buildPropertyOutboundMessages(property, detailsText)
    );
  }

  console.log(
    "[WhatsApp debug] Outbound message kinds:",
    outboundMessages.map((item) => item.kind)
  );

  const updatedLead = await finalizeLead(supabase, lead, history);

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
