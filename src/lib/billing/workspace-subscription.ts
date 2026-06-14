import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentSubscription,
  isSubscriptionUsable,
} from "@/lib/billing/get-current-subscription";
import {
  assertPlanAccess,
  assertWithinNumericLimit,
  getPlanLimits,
  isSubscriptionActiveForAccess,
  PlanAccessError,
  type PlanFeature,
} from "@/lib/billing/plan-limits";
import { countLeads } from "@/lib/data/leads";
import { countProperties } from "@/lib/data/properties";
import { assertWorkspaceAccess } from "@/lib/workspaces/workspace-access";
import type { CurrentSubscription, Database, PlanName } from "@/types/database";

type Client = SupabaseClient<Database>;

export class BillingAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingAccessError";
  }
}

const BILLING_ADMIN_ROLES = new Set(["owner", "admin"]);

export function isBillingAdminRole(role: string): boolean {
  return BILLING_ADMIN_ROLES.has(role);
}

/** Loads workspace subscription (auto-provisions local trial when missing). */
export async function getWorkspaceSubscription(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<CurrentSubscription | null> {
  return getCurrentSubscription(supabase, workspaceId, userId);
}

export class WorkspaceSubscriptionInactiveError extends PlanAccessError {
  readonly code = "subscription_inactive";

  constructor() {
    super(
      "Your subscription is inactive. Renew on the Billing page to use Agentive01.",
      "subscription"
    );
    this.name = "WorkspaceSubscriptionInactiveError";
  }
}

/** True when an error should skip inbound webhooks with 200 (not 500). */
export function isSubscriptionBillingBlockError(error: unknown): boolean {
  if (error instanceof WorkspaceSubscriptionInactiveError) {
    return true;
  }

  return error instanceof PlanAccessError && error.feature === "subscription";
}

/**
 * Requires an active, trialing, or past_due subscription before core automation.
 */
export async function assertWorkspaceSubscriptionActive(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<CurrentSubscription> {
  const subscription = await getWorkspaceSubscription(
    supabase,
    workspaceId,
    userId
  );

  if (!isSubscriptionActiveForAccess(subscription)) {
    throw new WorkspaceSubscriptionInactiveError();
  }

  return subscription!;
}

/**
 * Ensures the user is a workspace member with owner/admin role for billing mutations.
 */
export async function assertBillingWorkspaceAccess(
  supabase: Client,
  userId: string,
  workspaceId: string
) {
  const membership = await assertWorkspaceAccess(supabase, userId, workspaceId);

  if (!BILLING_ADMIN_ROLES.has(membership.role)) {
    throw new BillingAccessError(
      "Only workspace owners and admins can manage billing."
    );
  }

  return membership;
}

/**
 * Resolves active workspace and verifies billing admin access.
 */
export async function resolveBillingScope(
  supabase: Client,
  userId: string
): Promise<{ workspaceId: string; subscription: CurrentSubscription | null }> {
  const { getCurrentWorkspaceId } = await import(
    "@/lib/workspaces/get-current-workspace"
  );
  const workspaceId = await getCurrentWorkspaceId(supabase, userId);

  if (!workspaceId) {
    throw new BillingAccessError("No active workspace found.");
  }

  await assertBillingWorkspaceAccess(supabase, userId, workspaceId);
  const subscription = await getWorkspaceSubscription(
    supabase,
    workspaceId,
    userId
  );

  return { workspaceId, subscription };
}

export async function assertWorkspacePlanFeature(
  supabase: Client,
  workspaceId: string,
  userId: string,
  feature: PlanFeature
): Promise<CurrentSubscription> {
  const subscription = await getWorkspaceSubscription(
    supabase,
    workspaceId,
    userId
  );

  assertPlanAccess(subscription, feature);

  if (!subscription) {
    throw new PlanAccessError("Subscription not found.", "subscription");
  }

  return subscription;
}

export async function assertCanCreateLead(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<void> {
  const subscription = await getWorkspaceSubscription(
    supabase,
    workspaceId,
    userId
  );

  if (!isSubscriptionActiveForAccess(subscription)) {
    throw new PlanAccessError(
      "Your subscription is inactive. Renew on the Billing page to add leads.",
      "subscription"
    );
  }

  const limits = getPlanLimits(subscription!.plan_name);
  const current = await countLeads(supabase, workspaceId);
  assertWithinNumericLimit(current, limits.maxLeads, "Lead");
}

export async function assertCanCreateProperty(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<void> {
  const subscription = await getWorkspaceSubscription(
    supabase,
    workspaceId,
    userId
  );

  if (!isSubscriptionActiveForAccess(subscription)) {
    throw new PlanAccessError(
      "Your subscription is inactive. Renew on the Billing page to add properties.",
      "subscription"
    );
  }

  const limits = getPlanLimits(subscription!.plan_name);
  const current = await countProperties(supabase, workspaceId);
  assertWithinNumericLimit(current, limits.maxProperties, "Property");
}

export async function isFollowUpsEnabledForWorkspace(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const subscription = await getWorkspaceSubscription(
    supabase,
    workspaceId,
    userId
  );

  if (!isSubscriptionActiveForAccess(subscription)) {
    return false;
  }

  return getPlanLimits(subscription!.plan_name).followUpsEnabled;
}

export { assertPlanAccess, getPlanLimits, isSubscriptionUsable, PlanAccessError };

export type { PlanFeature, PlanName };
