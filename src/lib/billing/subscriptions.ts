import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  PlanName,
  Subscription,
  SubscriptionInsert,
  SubscriptionStatus,
} from "@/types/database";

type Client = SupabaseClient<Database>;

function firstRow<T>(rows: T[] | null | undefined): T | null {
  return rows?.[0] ?? null;
}

export async function getSubscriptionByWorkspaceId(
  supabase: Client,
  workspaceId: string
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  return firstRow(data);
}

export async function getSubscriptionByStripeSubscriptionId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch subscription by Stripe id: ${error.message}`);
  }

  return firstRow(data);
}

export async function getSubscriptionByStripeCustomerId(
  stripeCustomerId: string
): Promise<Subscription | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to fetch subscription by Stripe customer id: ${error.message}`
    );
  }

  return firstRow(data);
}

export type UpsertSubscriptionFromStripeInput = {
  workspace_id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_name: PlanName;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  trial_ends_at: string | null;
};

export async function upsertSubscriptionFromStripe(
  input: UpsertSubscriptionFromStripeInput
): Promise<Subscription> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const payload: SubscriptionInsert = {
    ...input,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("subscriptions")
    .upsert(payload, { onConflict: "workspace_id" })
    .select("*")
    .limit(1);

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`);
  }

  const row = firstRow(data);
  if (!row) {
    throw new Error("Subscription upsert returned no row.");
  }

  return row;
}

export async function ensureTrialSubscription(
  workspaceId: string,
  userId: string,
  trialDays: number
): Promise<Subscription> {
  const admin = createAdminClient();
  const existing = await getSubscriptionByWorkspaceId(admin, workspaceId);

  if (existing) {
    return existing;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  const { data, error } = await admin
    .from("subscriptions")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      plan_name: "starter",
      subscription_status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .select("*")
    .limit(1);

  if (error) {
    throw new Error(`Failed to create trial subscription: ${error.message}`);
  }

  const row = firstRow(data);
  if (!row) {
    throw new Error("Trial subscription insert returned no row.");
  }

  return row;
}

export async function updateSubscriptionCustomerId(
  workspaceId: string,
  stripeCustomerId: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to update Stripe customer id: ${error.message}`);
  }
}

export async function markSubscriptionCanceled(
  stripeSubscriptionId: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({
      subscription_status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) {
    throw new Error(`Failed to mark subscription canceled: ${error.message}`);
  }
}
