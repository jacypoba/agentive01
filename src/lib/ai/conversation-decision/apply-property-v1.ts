import { getPropertiesByIds } from "@/lib/data/properties";
import { buildReshowAvailability } from "@/lib/properties/property-availability";
import { getLastShownPropertyBatchIds } from "@/lib/properties/property-cards";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  Database,
  Lead,
  PendingPropertyOffer,
} from "@/types/database";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { shouldUseReshowBatch } from "@/lib/ai/intent-classifier";
import { findPropertyRecommendations } from "@/lib/properties/find-recommendations";
import { hasPropertyPivotEvidence } from "./apply-phase-b2";
import { buildPropertyConversationDecision } from "./build-property-decision";
import {
  executePropertyDecision,
  logPropertyDecisionV1Applied,
  type PropertyDecisionV1Execution,
} from "./execute-property-decision";
import {
  logPropertyV1Result,
  type PropertyV1SkipReason,
} from "@/lib/ai/forensic-production-logs";
import { isPropertyRelatedTurn } from "./is-property-related-turn";
import type { ResolvedCriteriaShadow } from "./resolve-criteria-shadow";
import type { ConversationDecision } from "./types";

type Client = SupabaseClient< Database>;

export type PropertyDecisionV1Result = PropertyDecisionV1Execution & {
  completePendingOffer: boolean;
  createPendingOffer: boolean;
};

export function isConversationDecisionEnginePropertyV1Enabled(): boolean {
  const flag =
    process.env.CONVERSATION_DECISION_ENGINE_PROPERTY_V1?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}

function shouldCompletePendingOffer(
  pendingOffer: PendingPropertyOffer | null,
  execution: PropertyDecisionV1Execution,
  latestMessage: string,
  resolved: ResolvedCriteriaShadow
): boolean {
  if (!pendingOffer) return false;
  if (execution.propertiesToRecommend.length === 0) return false;
  if (execution.decision.action !== "show_properties") return false;

  if (hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)) {
    return true;
  }

  return (
    resolved.pendingOfferAccepted &&
    !resolved.contextUse.userOverrodePendingOffer
  );
}

export async function tryApplyPropertyDecisionV1(
  supabase: Client,
  memoryLead: Lead,
  history: Conversation[],
  latestMessage: string,
  classified: ClassifiedIntent,
  pendingOffer: PendingPropertyOffer | null,
  language: ConversationDecision["language"]
): Promise<PropertyDecisionV1Result | null> {
  const enabled = isConversationDecisionEnginePropertyV1Enabled();
  const propertyRelated = isPropertyRelatedTurn(
    latestMessage,
    history,
    classified,
    memoryLead,
    pendingOffer
  );

  function finish(
    result: PropertyDecisionV1Result | null,
    skippedReason: PropertyV1SkipReason | null
  ): PropertyDecisionV1Result | null {
    logPropertyV1Result({
      leadId: memoryLead.id,
      enabled,
      isPropertyRelatedTurn: propertyRelated,
      applied: result != null,
      skippedReason,
      decisionAction: result?.decision.action ?? null,
      decisionReason: result?.decision.reason ?? null,
      qualifyingReplyPreview: result?.qualifyingReply?.slice(0, 120) ?? null,
      propertiesCount: result?.propertiesToRecommend.length ?? 0,
    });
    return result;
  }

  if (!enabled) {
    return finish(null, "flag_disabled");
  }

  if (!propertyRelated) {
    return finish(null, "not_property_related_turn");
  }

  if (shouldUseReshowBatch(classified)) {
    const reshowResult = await resolveReshowPropertyDecision(
      supabase,
      memoryLead,
      history,
      language
    );
    if (reshowResult) {
      logPropertyDecisionV1Applied({
        leadId: memoryLead.id,
        action: reshowResult.decision.action,
        criteria: reshowResult.decision.criteria,
        reason: reshowResult.decision.reason,
        propertiesFound: reshowResult.propertiesToRecommend.length,
        outboundKinds: reshowResult.outboundKinds,
      });
      return finish(reshowResult, "applied");
    }
  }

  const built = await buildPropertyConversationDecision(
    supabase,
    memoryLead,
    history,
    latestMessage,
    language,
    pendingOffer
  );

  if (
    ![
      "show_properties",
      "show_city_alternatives",
      "ask_clarifying_question",
      "no_match",
    ].includes(built.decision.action)
  ) {
    logPropertyV1Result({
      leadId: memoryLead.id,
      enabled,
      isPropertyRelatedTurn: propertyRelated,
      applied: false,
      skippedReason: "action_not_applicable",
      decisionAction: built.decision.action,
      decisionReason: built.decision.reason,
      qualifyingReplyPreview: null,
      propertiesCount: 0,
    });
    return null;
  }

  const execution = executePropertyDecision({
    built,
    history,
    leadId: memoryLead.id,
    language,
    isReshow: false,
  });

  logPropertyDecisionV1Applied({
    leadId: memoryLead.id,
    action: execution.decision.action,
    criteria: execution.decision.criteria,
    reason: execution.decision.reason,
    propertiesFound: execution.propertiesToRecommend.length,
    outboundKinds: execution.outboundKinds,
  });

  return finish(
    {
      ...execution,
      completePendingOffer: shouldCompletePendingOffer(
        pendingOffer,
        execution,
        latestMessage,
        built.resolved
      ),
      createPendingOffer: Boolean(
        execution.decision.action === "show_city_alternatives" &&
          execution.cityAlternatives &&
          execution.cityAlternatives.availableCities.length > 0 &&
          execution.propertiesToRecommend.length === 0 &&
          built.searchCriteria != null
      ),
    },
    "applied"
  );
}

export async function resolveReshowPropertyDecision(
  supabase: Client,
  memoryLead: Lead,
  history: Conversation[],
  language: ConversationDecision["language"]
): Promise<PropertyDecisionV1Result | null> {
  const lastBatchId = getLastShownPropertyBatchIds(history);
  if (lastBatchId.length === 0) {
    return null;
  }

  const workspaceId = requireLeadWorkspaceId(memoryLead);
  const reshown = await getPropertiesByIds(supabase, workspaceId, lastBatchId);
  if (reshown.length === 0) {
    return null;
  }

  const { properties: matchingProperties, criteria } =
    await findPropertyRecommendations(supabase, memoryLead, history, 20, {
      preferLatestMessage: false,
    });

  const availability = buildReshowAvailability(
    reshown,
    matchingProperties,
    history,
    criteria != null
  );

  const decision: ConversationDecision = {
    action: "show_properties",
    language,
    criteria: {
      city: criteria?.city ?? null,
      neighborhood: criteria?.neighborhood ?? null,
      budget: criteria?.maxBudget ?? null,
      propertyType: criteria?.propertyType ?? null,
      buyRentIntent: null,
    },
    contextUse: {
      usedPendingOffer: false,
      userOverrodePendingOffer: false,
      usedLeadMemory: false,
    },
    missingCriteria: [],
    reason: "reshow_batch",
    confidence: "high",
    replyInstruction: {
      kind: "deterministic",
      template: "recommendation_intro",
    },
  };

  return {
    propertiesToRecommend: reshown,
    availability,
    criteria: criteria ?? null,
    isReshow: true,
    freshQueryRan: false,
    cityAlternatives: null,
    qualifyingReply: null,
    decision,
    outboundKinds: ["text", "property_cards"],
    completePendingOffer: false,
    createPendingOffer: false,
  };
}
