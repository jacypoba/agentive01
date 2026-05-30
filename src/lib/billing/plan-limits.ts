import type { CurrentSubscription, PlanName } from "@/types/database";

export type PlanFeature =
  | "follow_ups"
  | "analytics"
  | "calendar_sync"
  | "ai_assistant"
  | "multi_whatsapp";

export type PlanLimits = {
  maxLeads: number | null;
  maxProperties: number | null;
  maxWhatsAppConnections: number;
  maxTeamMembers: number;
  maxFollowUpsPerLead: number;
  /** Monthly AI reply budget (0 = disabled). null = unlimited. */
  maxAiRepliesPerMonth: number | null;
  followUpsEnabled: boolean;
  analyticsEnabled: boolean;
  calendarSyncEnabled: boolean;
  aiAssistantEnabled: boolean;
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  starter: {
    maxLeads: 150,
    maxProperties: 30,
    maxWhatsAppConnections: 1,
    maxTeamMembers: 1,
    maxFollowUpsPerLead: 0,
    maxAiRepliesPerMonth: 500,
    followUpsEnabled: false,
    analyticsEnabled: false,
    calendarSyncEnabled: true,
    aiAssistantEnabled: true,
  },
  pro: {
    maxLeads: 2000,
    maxProperties: 250,
    maxWhatsAppConnections: 2,
    maxTeamMembers: 5,
    maxFollowUpsPerLead: 5,
    maxAiRepliesPerMonth: 5000,
    followUpsEnabled: true,
    analyticsEnabled: true,
    calendarSyncEnabled: true,
    aiAssistantEnabled: true,
  },
  enterprise: {
    maxLeads: null,
    maxProperties: null,
    maxWhatsAppConnections: 10,
    maxTeamMembers: 25,
    maxFollowUpsPerLead: 5,
    maxAiRepliesPerMonth: null,
    followUpsEnabled: true,
    analyticsEnabled: true,
    calendarSyncEnabled: true,
    aiAssistantEnabled: true,
  },
};

export class PlanAccessError extends Error {
  readonly feature: PlanFeature | "subscription" | "limit";

  constructor(
    message: string,
    feature: PlanAccessError["feature"] = "subscription"
  ) {
    super(message);
    this.name = "PlanAccessError";
    this.feature = feature;
  }
}

export function getPlanLimits(planName: PlanName): PlanLimits {
  return PLAN_LIMITS[planName] ?? PLAN_LIMITS.starter;
}

const FEATURE_TO_LIMIT: Record<
  PlanFeature,
  (limits: PlanLimits) => boolean
> = {
  follow_ups: (limits) => limits.followUpsEnabled,
  analytics: (limits) => limits.analyticsEnabled,
  calendar_sync: (limits) => limits.calendarSyncEnabled,
  ai_assistant: (limits) => limits.aiAssistantEnabled,
  multi_whatsapp: (limits) => limits.maxWhatsAppConnections > 1,
};

export function isSubscriptionActiveForAccess(
  subscription: CurrentSubscription | null
): boolean {
  if (!subscription) {
    return false;
  }

  if (
    subscription.subscription_status === "canceled" ||
    subscription.subscription_status === "unpaid" ||
    subscription.subscription_status === "incomplete_expired"
  ) {
    return false;
  }

  if (subscription.subscription_status === "trialing") {
    if (!subscription.trial_ends_at) {
      return true;
    }
    return new Date(subscription.trial_ends_at).getTime() > Date.now();
  }

  return (
    subscription.subscription_status === "active" ||
    subscription.subscription_status === "past_due"
  );
}

export function assertPlanAccess(
  subscription: CurrentSubscription | null,
  feature: PlanFeature
): void {
  if (!isSubscriptionActiveForAccess(subscription)) {
    throw new PlanAccessError(
      "An active subscription is required for this feature. Upgrade your plan on the Billing page.",
      "subscription"
    );
  }

  const limits = getPlanLimits(subscription!.plan_name);
  const allowed = FEATURE_TO_LIMIT[feature](limits);

  if (!allowed) {
    const labels: Record<PlanFeature, string> = {
      follow_ups: "Follow-up automation",
      analytics: "Analytics",
      calendar_sync: "Google Calendar sync",
      ai_assistant: "AI assistant",
      multi_whatsapp: "Multiple WhatsApp connections",
    };
    throw new PlanAccessError(
      `${labels[feature]} is not included in your ${subscription!.plan_name} plan. Upgrade to unlock it.`,
      feature
    );
  }
}

export function assertWithinNumericLimit(
  currentCount: number,
  limit: number | null,
  resourceLabel: string
): void {
  if (limit == null) {
    return;
  }

  if (currentCount >= limit) {
    throw new PlanAccessError(
      `${resourceLabel} limit reached (${limit}). Upgrade your plan to add more.`,
      "limit"
    );
  }
}

export function formatLimitValue(value: number | null): string {
  return value == null ? "Unlimited" : value.toLocaleString("en-GB");
}
