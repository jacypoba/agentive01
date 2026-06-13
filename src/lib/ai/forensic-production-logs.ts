import type { MessageIntent } from "@/lib/ai/intent-classifier";
import type { PropertyAvailability } from "@/lib/properties/property-availability";

/** Temporary production forensics — remove after EN Roma routing audit. */

export function getForensicDeploymentMarker(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    "local"
  );
}

export function logProcessClientMessageForensicStart(input: {
  leadId: string;
  latestMessage: string;
  propertyV1Raw: string | undefined;
  propertyV1Enabled: boolean;
}): void {
  console.log("[Forensic Turn Start]", {
    deployment: getForensicDeploymentMarker(),
    leadId: input.leadId,
    latestMessage: input.latestMessage,
    CONVERSATION_DECISION_ENGINE_PROPERTY_V1: input.propertyV1Raw ?? null,
    propertyV1Enabled: input.propertyV1Enabled,
  });
}

export function logPropertyV1Entry(input: {
  leadId: string;
  latestMessage: string;
  enabled: boolean;
  isPropertyRelatedTurn: boolean;
  intent: string;
}): void {
  console.log("[Property V1 Entry]", {
    deployment: getForensicDeploymentMarker(),
    wasCalled: true,
    ...input,
  });
}

export type PropertyV1SkipReason =
  | "flag_disabled"
  | "not_property_related_turn"
  | "reshow_batch_unresolved"
  | "action_not_applicable"
  | "applied";

export function logPropertyV1Result(input: {
  leadId: string;
  enabled: boolean;
  isPropertyRelatedTurn: boolean;
  applied: boolean;
  skippedReason: PropertyV1SkipReason | null;
  decisionAction: string | null;
  decisionReason: string | null;
  qualifyingReplyPreview: string | null;
  propertiesCount: number;
}): void {
  console.log("[Property V1 Result]", {
    deployment: getForensicDeploymentMarker(),
    wasCalled: true,
    ...input,
  });
}

export type ConsultantFallbackForensicContext = {
  reason: string;
  intent: MessageIntent;
  propertyV1Applied: boolean;
  gatedQualifyingReply: string | null;
  propertiesToRecommendLength: number;
  availability: PropertyAvailability;
  leadId: string;
};

export function logConsultantFallbackUsed(
  input: ConsultantFallbackForensicContext & {
    source: "generateAIReply" | "getConsultantLanguageFallback";
    fallbackPreview: string;
  }
): void {
  console.log("[Consultant Fallback Used]", {
    deployment: getForensicDeploymentMarker(),
    source: input.source,
    reason: input.reason,
    intent: input.intent,
    propertyV1Applied: input.propertyV1Applied,
    gatedQualifyingReply: input.gatedQualifyingReply,
    gatedQualifyingReplyPreview: input.gatedQualifyingReply?.slice(0, 120) ?? null,
    propertiesToRecommendLength: input.propertiesToRecommendLength,
    availability: {
      matchingTotal: input.availability.matchingTotal,
      noMatchesInDatabase: input.availability.noMatchesInDatabase,
      criteriaMissing: input.availability.criteriaMissing,
      allShown: input.availability.allShown,
    },
    leadId: input.leadId,
    fallbackPreview: input.fallbackPreview,
  });
}
