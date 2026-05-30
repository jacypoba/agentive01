import type { SupabaseClient } from "@supabase/supabase-js";
import { isSubscriptionActiveForAccess } from "@/lib/billing/plan-limits";
import { ensureTrialSubscription, getSubscriptionByWorkspaceId } from "@/lib/billing/subscriptions";
import { TRIAL_DAYS } from "@/lib/stripe/plans";
import type { CurrentSubscription, Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const ACTIVE_STATUSES = new Set(["trialing", "active"]);

function computeDaysLeftInTrial(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) {
    return null;
  }

  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  const diffMs = end - now;

  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function enrichSubscription(
  subscription: Awaited<ReturnType<typeof getSubscriptionByWorkspaceId>>
): CurrentSubscription | null {
  if (!subscription) {
    return null;
  }

  const isTrialing = subscription.subscription_status === "trialing";
  const isActive = ACTIVE_STATUSES.has(subscription.subscription_status);

  return {
    ...subscription,
    isTrialing,
    isActive,
    daysLeftInTrial: isTrialing
      ? computeDaysLeftInTrial(subscription.trial_ends_at)
      : null,
  };
}

/**
 * Returns the subscription for a workspace, provisioning a local free trial
 * record when none exists yet.
 */
export async function getCurrentSubscription(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<CurrentSubscription | null> {
  let subscription = await getSubscriptionByWorkspaceId(supabase, workspaceId);

  if (!subscription) {
    subscription = await ensureTrialSubscription(workspaceId, userId, TRIAL_DAYS);
  }

  return enrichSubscription(subscription);
}

export function isSubscriptionUsable(
  subscription: CurrentSubscription | null
): boolean {
  return isSubscriptionActiveForAccess(subscription);
}
