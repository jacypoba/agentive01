import type Stripe from "stripe";
import { upsertSubscriptionFromStripe } from "@/lib/billing/subscriptions";
import { getPlanByPriceId } from "@/lib/stripe/plan-prices.server";
import type { PlanName, SubscriptionStatus } from "@/types/database";

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

function resolvePlanName(subscription: Stripe.Subscription): PlanName {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
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

export type SyncSubscriptionInput = {
  stripeSubscription: Stripe.Subscription;
  workspaceId: string;
  userId: string;
  stripeCustomerId?: string | null;
};

/** Persists Stripe subscription state to Supabase (service role). */
export async function syncStripeSubscriptionToSupabase(
  input: SyncSubscriptionInput
): Promise<void> {
  const { stripeSubscription, workspaceId, userId } = input;
  const priceId = stripeSubscription.items.data[0]?.price?.id ?? null;
  const customerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id ?? input.stripeCustomerId ?? null;

  await upsertSubscriptionFromStripe({
    workspace_id: workspaceId,
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: priceId,
    plan_name: resolvePlanName(stripeSubscription),
    subscription_status: mapStripeStatus(stripeSubscription.status),
    current_period_end: getCurrentPeriodEnd(stripeSubscription),
    trial_ends_at: toIsoFromUnix(stripeSubscription.trial_end),
  });
}
