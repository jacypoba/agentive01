import { extractAndApplyLeadQualification } from "@/lib/ai/apply-qualification";
import { loadConversationMemory } from "@/lib/ai/conversation-memory";
import {
  dedupeAiReply,
  normalizeForDedupe,
  pickUnusedVariant,
} from "@/lib/ai/dedupe-reply";
import {
  buildClosingReply,
  logIntentDecision,
  sanitizeGuardedReply,
} from "@/lib/ai/guardrails";
import { pickNoMatchIntroReply } from "@/lib/ai/no-match-reply";
import {
  buildPendingOfferFromCityAlternative,
  completePendingPropertyOffer,
  findPropertiesForPendingOffer,
  getActivePendingPropertyOffer,
  logPendingOfferAccepted,
  logPendingOfferCompleted,
  logPendingOfferCreated,
  savePendingPropertyOffer,
} from "@/lib/ai/pending-property-offer";
import {
  buildCityAlternativeFallbackText,
  logCityAlternativeFallback,
  type CityAlternativeSummary,
} from "@/lib/properties/city-alternatives";
import { findCityAlternativesForCriteria } from "@/lib/properties/find-city-alternatives";
import {
  evaluatePropertyRecommendationGate,
  logPropertyRecommendationGate,
} from "@/lib/properties/recommendation-gate";
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
import { getOrCreateWorkspaceSettings } from "@/lib/data/workspace-settings";
import { cancelFollowUpsOnClientReply } from "@/lib/follow-ups/scheduler";
import { getExhaustedMatchLines } from "@/lib/i18n/messages";
import { syncLeadPreferredLanguage } from "@/lib/i18n/sync-language";
import {
  logLanguageFinalCheck,
  resolveConversationLanguageDebug,
} from "@/lib/i18n/resolve-language";
import { derivePropertySearchCriteriaDebug } from "@/lib/properties/search-criteria";
import { runConversationDecisionShadowTurn } from "@/lib/ai/conversation-decision";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { findPropertyRecommendations } from "@/lib/properties/find-recommendations";
import { buildRecommendationIntroText } from "@/lib/properties/recommendation-intros";
import {
  analyzePropertyAvailability,
  buildReshowAvailability,
  type PropertyAvailability,
} from "@/lib/properties/property-availability";
import {
  buildReshowIntroText,
  formatPropertyCard,
  formatPropertyListingRecord,
  formatPropertyWhatsAppPackageText,
  getLastShownPropertyBatchIds,
  isCatalogBatch,
} from "@/lib/properties/property-cards";
import {
  buildCatalogOutboundMessages,
  buildPropertyOutboundMessages,
  type OutboundWhatsAppMessage,
} from "@/lib/properties/send-whatsapp";
import { getLeadById } from "@/lib/data/leads";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { WorkspaceAISettings } from "@/lib/workspace-settings/types";
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
  property: Property,
  language: SupportedLanguage
): Promise<Conversation[]> {
  const saved: Conversation[] = [];
  const detailsText = formatPropertyCard(property, language);

  saved.push(await saveAiMessage(supabase, leadId, detailsText));

  const listingRecord = formatPropertyListingRecord(property, language);
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
    language: SupportedLanguage;
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
        requireLeadWorkspaceId(memoryLead),
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
          cityAlternatives: null,
        };
      }
    }
  }

  const availability = analyzePropertyAvailability(
    matchingProperties,
    history,
    criteria != null
  );

  let cityAlternatives: CityAlternativeSummary | null = null;
  if (
    criteria?.city &&
    matchingProperties.length === 0 &&
    criteria != null
  ) {
    cityAlternatives = await findCityAlternativesForCriteria(
      supabase,
      requireLeadWorkspaceId(memoryLead),
      criteria
    );
  }

  return {
    propertiesToRecommend: availability.toSend,
    availability,
    criteria,
    isReshow: false,
    freshQueryMade: freshQuery && criteria != null,
    cityAlternatives,
  };
}

async function resolvePropertiesFromPendingOffer(
  supabase: Client,
  memoryLead: Lead,
  history: Conversation[]
) {
  const offer = getActivePendingPropertyOffer(memoryLead);
  if (!offer) {
    return {
      propertiesToRecommend: [] as Property[],
      availability: {
        ...EMPTY_AVAILABILITY,
        criteriaMissing: true,
      },
      criteria: null,
      isReshow: false,
      freshQueryMade: false,
      cityAlternatives: null,
    };
  }

  logPendingOfferAccepted(memoryLead.id, offer);

  const { properties: matchingProperties, criteria } =
    await findPropertiesForPendingOffer(supabase, memoryLead, offer);

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
    freshQueryMade: false,
    cityAlternatives: null,
  };
}

async function buildIntroReply(
  memoryLead: Lead,
  history: Conversation[],
  propertiesToRecommend: Property[],
  availability: PropertyAvailability,
  classified: ReturnType<typeof classifyMessageIntent>,
  isReshow: boolean,
  freshQueryMade: boolean,
  language: SupportedLanguage,
  workspaceSettings: WorkspaceAISettings | null,
  cityAlternatives: CityAlternativeSummary | null = null
): Promise<string> {
  if (isReshow && propertiesToRecommend.length > 0) {
    return buildReshowIntroText(
      language,
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
      getExhaustedMatchLines(language),
      history,
      `${memoryLead.id}:exhausted`
    );
  }

  if (
    propertiesToRecommend.length === 0 &&
    availability.noMatchesInDatabase &&
    availability.matchingTotal === 0 &&
    !availability.criteriaMissing &&
    classified.intent === "accept_pending_offer"
  ) {
    return pickNoMatchIntroReply(language, history, memoryLead.id);
  }

  if (
    propertiesToRecommend.length === 0 &&
    availability.noMatchesInDatabase &&
    availability.matchingTotal === 0 &&
    !availability.criteriaMissing &&
    (classified.intent === "property_search" ||
      classified.intent === "ask_more_options")
  ) {
    if (cityAlternatives && cityAlternatives.availableCities.length > 0) {
      logCityAlternativeFallback(cityAlternatives, memoryLead.id, language);
      return buildCityAlternativeFallbackText(language, cityAlternatives);
    }

    return pickNoMatchIntroReply(language, history, memoryLead.id);
  }

  if (propertiesToRecommend.length > 0) {
    return buildRecommendationIntroText(
      language,
      history,
      memoryLead.id,
      propertiesToRecommend.length,
      classified,
      freshQueryMade
    );
  }

  return generateAIReply(
    memoryLead,
    history,
    propertiesToRecommend,
    availability,
    clientAskedForMoreOptions(history),
    isReshow,
    classified.intent,
    language,
    workspaceSettings
  );
}

async function finalizeLead(
  supabase: Client,
  lead: Lead,
  history: Conversation[]
): Promise<Lead> {
  const fullHistory = await getConversationsByLead(
    supabase,
    requireLeadWorkspaceId(lead),
    lead.id
  );
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

  await cancelFollowUpsOnClientReply(supabase, lead);

  const { lead: memoryLead, history } = await loadConversationMemory(
    supabase,
    lead
  );

  const languageDebug = resolveConversationLanguageDebug({
    latestMessage: message,
    leadPreferred: memoryLead.preferred_language,
    leadId: memoryLead.id,
    conversationHistory: history,
  });
  const language = languageDebug.finalLanguage;
  const languageLead = await syncLeadPreferredLanguage(
    supabase,
    memoryLead,
    message,
    history
  );

  const workspaceId = requireLeadWorkspaceId(lead);
  const workspaceSettings = await getOrCreateWorkspaceSettings(
    supabase,
    workspaceId
  );

  const classified = classifyMessageIntent(history, languageLead);
  logIntentDecision(lead.id, classified, language);

  const aiMessages: Conversation[] = [];
  const outboundMessages: OutboundWhatsAppMessage[] = [];
  const seenThisTurn = new Set<string>();

  if (classified.intent === "thanks_or_closing") {
    const closing = buildClosingReply(memoryLead, history, language);
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
          language,
        }
      );
    } else {
      console.log("[WhatsApp guardrails] Thanks/closing — no second closing sent", {
        leadId: lead.id,
      });
    }

    const updatedLead = await finalizeLead(supabase, lead, history);

    runConversationDecisionShadowTurn({
      leadId: lead.id,
      latestMessage: message,
      history,
      lead: languageLead,
      language,
      classified,
      propertiesToRecommendCount: 0,
      availability: EMPTY_AVAILABILITY,
      cityAlternatives: null,
      recommendationGate: null,
    });

    logLanguageFinalCheck({
      incomingText: message,
      storedLanguage: memoryLead.preferred_language,
      detectedLanguage: languageDebug.detectedLanguage,
      finalLanguage: language,
      replyPreview: aiMessages[0]?.message ?? null,
    });

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

  let cityAlternatives: CityAlternativeSummary | null = null;
  let recommendationGate: ReturnType<
    typeof evaluatePropertyRecommendationGate
  > | null = null;
  let searchDebugForShadow: ReturnType<
    typeof derivePropertySearchCriteriaDebug
  > | null = null;

  if (shouldQueryProperties(classified)) {
    const searchDebug = derivePropertySearchCriteriaDebug(
      memoryLead,
      history,
      { preferLatestMessage: shouldRunFreshPropertyQuery(classified) }
    );
    searchDebugForShadow = searchDebug;

    const resolved =
      classified.intent === "accept_pending_offer"
        ? await resolvePropertiesFromPendingOffer(
            supabase,
            memoryLead,
            history
          )
        : await resolvePropertiesToRecommend(
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

    cityAlternatives = resolved.cityAlternatives;

    if (
      classified.intent !== "accept_pending_offer" &&
      cityAlternatives &&
      cityAlternatives.availableCities.length > 0 &&
      propertiesToRecommend.length === 0 &&
      availability.noMatchesInDatabase &&
      availability.matchingTotal === 0 &&
      !availability.criteriaMissing &&
      (classified.intent === "property_search" ||
        classified.intent === "ask_more_options") &&
      criteria
    ) {
      const pendingOffer = buildPendingOfferFromCityAlternative(
        cityAlternatives,
        criteria
      );
      await savePendingPropertyOffer(
        supabase,
        workspaceId,
        lead.id,
        pendingOffer
      );
      logPendingOfferCreated(lead.id, pendingOffer);
    }

    recommendationGate = evaluatePropertyRecommendationGate({
      leadId: lead.id,
      lead: memoryLead,
      history,
      searchDebug,
      classified,
      language,
      hasPropertiesToSend: propertiesToRecommend.length > 0,
      isReshow,
    });
    logPropertyRecommendationGate(lead.id, recommendationGate);

    if (
      !recommendationGate.shouldSendRecommendations &&
      propertiesToRecommend.length > 0
    ) {
      propertiesToRecommend = [];
    }

    console.log("[WhatsApp debug] Multilingual search", {
      leadId: lead.id,
      detectedLanguage: language,
      rawUserInput: searchDebug.rawUserInput,
      normalizedCity: searchDebug.normalizedCity,
      normalizedPropertyType: searchDebug.normalizedPropertyType,
      normalizedBudget: searchDebug.normalizedBudget,
      intent: classified.intent,
      matchedPropertiesCount: availability.matchingTotal,
      sendingCount: propertiesToRecommend.length,
      wantsReshow: classified.wantsReshow,
      wantsMore: classified.wantsMore,
      freshQueryMade,
      isReshow,
    });
  }

  runConversationDecisionShadowTurn({
    leadId: lead.id,
    latestMessage: message,
    history,
    lead: languageLead,
    language,
    classified,
    searchDebug: searchDebugForShadow,
    propertiesToRecommendCount: propertiesToRecommend.length,
    availability,
    cityAlternatives,
    recommendationGate,
  });

  const guardContext = {
    intent: classified.intent,
    freshQueryMade,
    propertiesSent: propertiesToRecommend.length > 0,
    language,
  };

  const gatedQualifyingReply =
    shouldQueryProperties(classified) &&
    propertiesToRecommend.length === 0 &&
    recommendationGate != null &&
    !recommendationGate.shouldSendRecommendations &&
    recommendationGate.qualifyingReply
      ? recommendationGate.qualifyingReply
      : null;

  const aiReply =
    gatedQualifyingReply ??
    (await buildIntroReply(
      languageLead,
      history,
      propertiesToRecommend,
      availability,
      classified,
      isReshow,
      freshQueryMade,
      language,
      workspaceSettings,
      cityAlternatives
    ));

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
      formatPropertyWhatsAppPackageText(property, language)
    );

    if (!isReshow) {
      for (const property of propertiesToRecommend) {
        const propertyMessages = await persistPropertyRecommendation(
          supabase,
          lead.id,
          property,
          language
        );
        aiMessages.push(...propertyMessages);
      }
    }

    outboundMessages.push(
      ...buildCatalogOutboundMessages(propertiesToRecommend, detailsTexts)
    );

    if (
      classified.intent === "accept_pending_offer" &&
      propertiesToRecommend.length > 0
    ) {
      const activeOffer = getActivePendingPropertyOffer(memoryLead);
      if (activeOffer) {
        await completePendingPropertyOffer(
          supabase,
          workspaceId,
          lead.id,
          activeOffer
        );
        logPendingOfferCompleted(lead.id, activeOffer);
      }
    }

    if (!isReshow) {
      const closingText = await generateCatalogComparison(
        languageLead,
        history,
        propertiesToRecommend,
        language
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
    if (!isReshow) {
      const propertyMessages = await persistPropertyRecommendation(
        supabase,
        lead.id,
        property,
        language
      );
      aiMessages.push(...propertyMessages);
    }

    outboundMessages.push(
      ...buildPropertyOutboundMessages(
        property,
        formatPropertyWhatsAppPackageText(property, language)
      )
    );

    if (classified.intent === "accept_pending_offer") {
      const activeOffer = getActivePendingPropertyOffer(memoryLead);
      if (activeOffer) {
        await completePendingPropertyOffer(
          supabase,
          workspaceId,
          lead.id,
          activeOffer
        );
        logPendingOfferCompleted(lead.id, activeOffer);
      }
    }
  }

  console.log(
    "[WhatsApp debug] Outbound message kinds:",
    outboundMessages.map((item) => item.kind)
  );

  const updatedLead = await finalizeLead(supabase, lead, history);

  logLanguageFinalCheck({
    incomingText: message,
    storedLanguage: memoryLead.preferred_language,
    detectedLanguage: languageDebug.detectedLanguage,
    finalLanguage: language,
    replyPreview: aiMessages[0]?.message ?? null,
  });

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

  const { workspaceId } = await resolveTenantScope(supabase, user.id);
  const lead = await getLeadById(supabase, workspaceId, leadId);
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
