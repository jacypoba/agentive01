import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getSubscriptionByStripeSubscriptionId,
  markSubscriptionCanceled,
} from "@/lib/billing/subscriptions";
import { getStripe } from "@/lib/stripe/client";
import { syncStripeSubscriptionToSupabase } from "@/lib/stripe/sync-subscription";

export const runtime = "nodejs";

async function resolveWorkspaceContext(
  subscription: Stripe.Subscription
): Promise<{ workspaceId: string; userId: string } | null> {
  const workspaceId = subscription.metadata?.workspace_id;
  const userId = subscription.metadata?.user_id;

  if (workspaceId && userId) {
    return { workspaceId, userId };
  }

  const existing = await getSubscriptionByStripeSubscriptionId(subscription.id);
  if (existing) {
    return {
      workspaceId: existing.workspace_id,
      userId: existing.user_id,
    };
  }

  return null;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  const workspaceId = session.metadata?.workspace_id;
  const userId = session.metadata?.user_id;

  if (!workspaceId || !userId) {
    console.warn("[Stripe webhook] checkout.session.completed missing metadata");
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await syncStripeSubscriptionToSupabase({
    stripeSubscription: subscription,
    workspaceId,
    userId,
    stripeCustomerId:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null,
  });
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const context = await resolveWorkspaceContext(subscription);
  if (!context) {
    console.warn(
      "[Stripe webhook] subscription.updated could not resolve workspace",
      subscription.id
    );
    return;
  }

  await syncStripeSubscriptionToSupabase({
    stripeSubscription: subscription,
    workspaceId: context.workspaceId,
    userId: context.userId,
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  await markSubscriptionCanceled(subscription.id);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("[Stripe webhook] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("[Stripe webhook] handler error", event.type, error);
    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
