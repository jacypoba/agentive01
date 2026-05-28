import type Stripe from "stripe";
import {
  getSubscriptionByStripeCustomerId,
  getSubscriptionByWorkspaceId,
  upsertSubscriptionFromStripe,
} from "@/lib/billing/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getPlanByPriceId } from "@/lib/stripe/plan-prices.server";
import type { PlanName, Subscription, SubscriptionStatus } from "@/types/database";

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "unpaid",
    "paused",
  ];

  if (allowed.includes(status as SubscriptionStatus)) {
    return status as SubscriptionStatus;
  }

  return "incomplete";
}

function getSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price;

  if (typeof price === "string") {
    return price;
  }

  return price?.id ?? null;
}

function resolvePlanName(
  subscription: Stripe.Subscription,
  planNameOverride?: string | null
): PlanName {
  if (
    planNameOverride === "starter" ||
    planNameOverride === "pro" ||
    planNameOverride === "enterprise"
  ) {
    return planNameOverride;
  }

  const priceId = getSubscriptionPriceId(subscription);
  const fromPrice = getPlanByPriceId(priceId);

  if (fromPrice) {
    return fromPrice.id;
  }

  const metadataPlan = subscription.metadata?.plan_name;
  if (
    metadataPlan === "starter" ||
    metadataPlan === "pro" ||
    metadataPlan === "enterprise"
  ) {
    return metadataPlan;
  }

  return "starter";
}

function toIsoFromUnix(seconds: number | null | undefined): string | null {
  if (!seconds) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
  return toIsoFromUnix(itemPeriodEnd);
}

function resolveTrialEndsAt(
  subscription: Stripe.Subscription,
  status: SubscriptionStatus
): string | null {
  if (status === "active") {
    return null;
  }

  return toIsoFromUnix(subscription.trial_end);
}

export type SyncSubscriptionInput = {
  stripeSubscription: Stripe.Subscription;
  workspaceId: string;
  userId: string;
  stripeCustomerId?: string | null;
  planNameOverride?: string | null;
};

export type SyncSubscriptionResult = {
  subscription: Subscription;
  priceId: string | null;
  planName: PlanName;
  status: SubscriptionStatus;
};

/** Persists Stripe subscription state to Supabase (service role). */
export async function syncStripeSubscriptionToSupabase(
  input: SyncSubscriptionInput
): Promise<SyncSubscriptionResult> {
  const { stripeSubscription, workspaceId, userId } = input;
  const priceId = getSubscriptionPriceId(stripeSubscription);
  const status = mapStripeStatus(stripeSubscription.status);
  const planName = resolvePlanName(
    stripeSubscription,
    input.planNameOverride
  );
  const customerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id ?? input.stripeCustomerId ?? null;

  const subscription = await upsertSubscriptionFromStripe({
    workspace_id: workspaceId,
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: priceId,
    plan_name: planName,
    subscription_status: status,
    current_period_end: getCurrentPeriodEnd(stripeSubscription),
    trial_ends_at: resolveTrialEndsAt(stripeSubscription, status),
  });

  return {
    subscription,
    priceId,
    planName,
    status,
  };
}

const SUBSCRIPTION_EXPAND = ["items.data.price"] as const;

export async function retrieveStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: [...SUBSCRIPTION_EXPAND],
  });
}

function pickPreferredStripeSubscription(
  subscriptions: Stripe.Subscription[]
): Stripe.Subscription | null {
  if (subscriptions.length === 0) {
    return null;
  }

  const rank = (status: Stripe.Subscription.Status): number => {
    switch (status) {
      case "active":
        return 0;
      case "trialing":
        return 1;
      case "past_due":
        return 2;
      default:
        return 3;
    }
  };

  return [...subscriptions].sort((a, b) => {
    const rankDiff = rank(a.status) - rank(b.status);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return b.created - a.created;
  })[0];
}

/**
 * Pulls the latest Stripe subscription for a workspace and upserts locally.
 * Used after checkout success when webhooks may be delayed or misconfigured.
 */
export async function reconcileWorkspaceSubscriptionFromStripe(
  workspaceId: string,
  userId: string
): Promise<SyncSubscriptionResult | null> {
  const admin = createAdminClient();
  const local = await getSubscriptionByWorkspaceId(admin, workspaceId);
  const customerId = local?.stripe_customer_id ?? null;

  if (!customerId) {
    console.log("[Stripe reconcile] no customer id for workspace", workspaceId);
    return null;
  }

  const stripe = getStripe();
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
    expand: ["data.items.data.price"],
  });

  const preferred = pickPreferredStripeSubscription(listed.data);
  if (!preferred) {
    console.log("[Stripe reconcile] no Stripe subscriptions for customer", {
      workspaceId,
      customerId,
    });
    return null;
  }

  const result = await syncStripeSubscriptionToSupabase({
    stripeSubscription: preferred,
    workspaceId,
    userId,
    stripeCustomerId: customerId,
    planNameOverride: preferred.metadata?.plan_name,
  });

  console.log("[Stripe reconcile] upserted subscription", {
    workspaceId,
    customerId,
    subscriptionId: preferred.id,
    priceId: result.priceId,
    planName: result.planName,
    status: result.status,
    subscriptionRowId: result.subscription.id,
  });

  return result;
}

export async function resolveWorkspaceFromStripeCustomer(
  customerId: string
): Promise<{ workspaceId: string; userId: string } | null> {
  const row = await getSubscriptionByStripeCustomerId(customerId);
  if (!row) {
    return null;
  }

  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
  };
}
