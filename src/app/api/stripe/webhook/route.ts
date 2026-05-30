import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getSubscriptionByStripeSubscriptionId,
  markSubscriptionCanceled,
} from "@/lib/billing/subscriptions";
import {
  getStripeCustomerId,
  getSubscriptionIdFromInvoice,
  resolveWebhookWorkspaceContext,
} from "@/lib/billing/webhook-workspace";
import {
  isStripeWebhookEventProcessed,
  markStripeWebhookEventProcessed,
} from "@/lib/billing/webhook-events";
import { getStripe } from "@/lib/stripe/client";
import {
  reconcileWorkspaceSubscriptionFromStripe,
  resolveWorkspaceFromStripeCustomer,
  retrieveStripeSubscription,
  syncStripeSubscriptionToSupabase,
  type SyncSubscriptionResult,
} from "@/lib/stripe/sync-subscription";

export const runtime = "nodejs";

function logSyncResult(
  eventType: string,
  context: {
    customerId: string | null;
    subscriptionId: string | null;
    workspaceId: string | null;
    priceId: string | null;
    planName: string | null;
    status: string | null;
  },
  result: SyncSubscriptionResult | null,
  error?: unknown
) {
  console.log("[Stripe webhook]", {
    eventType,
    customerId: context.customerId,
    subscriptionId: context.subscriptionId,
    priceId: context.priceId,
    resolvedPlanName: context.planName,
    workspaceId: context.workspaceId,
    upserted:
      result != null
        ? {
            subscriptionRowId: result.subscription.id,
            planName: result.planName,
            status: result.status,
            stripeSubscriptionId: result.subscription.stripe_subscription_id,
          }
        : null,
    error: error instanceof Error ? error.message : error ?? null,
  });
}

async function resolveWorkspaceContext(input: {
  subscription: Stripe.Subscription;
  sessionMetadata?: Stripe.Metadata | null;
}): Promise<{ workspaceId: string; userId: string } | null> {
  const { subscription, sessionMetadata } = input;

  const existing = await getSubscriptionByStripeSubscriptionId(subscription.id);
  const customerId = getStripeCustomerId(subscription.customer);
  const customerLookup = customerId
    ? await resolveWorkspaceFromStripeCustomer(customerId)
    : null;

  return resolveWebhookWorkspaceContext({
    subscription,
    sessionMetadata,
    existingSubscription: existing,
    customerLookup,
  });
}

async function syncSubscriptionEvent(
  eventType: string,
  subscription: Stripe.Subscription,
  options?: {
    sessionMetadata?: Stripe.Metadata | null;
    stripeCustomerId?: string | null;
    planNameOverride?: string | null;
  }
): Promise<SyncSubscriptionResult | null> {
  const expanded = await retrieveStripeSubscription(subscription.id);
  const context = await resolveWorkspaceContext({
    subscription: expanded,
    sessionMetadata: options?.sessionMetadata,
  });

  if (!context) {
    logSyncResult(
      eventType,
      {
        customerId: getStripeCustomerId(expanded.customer),
        subscriptionId: expanded.id,
        workspaceId: null,
        priceId: expanded.items.data[0]?.price
          ? typeof expanded.items.data[0].price === "string"
            ? expanded.items.data[0].price
            : expanded.items.data[0].price.id
          : null,
        planName: options?.planNameOverride ?? expanded.metadata?.plan_name ?? null,
        status: expanded.status,
      },
      null,
      "could not resolve workspace/user"
    );
    return null;
  }

  try {
    const result = await syncStripeSubscriptionToSupabase({
      stripeSubscription: expanded,
      workspaceId: context.workspaceId,
      userId: context.userId,
      stripeCustomerId: options?.stripeCustomerId ?? getStripeCustomerId(expanded.customer),
      planNameOverride:
        options?.planNameOverride ??
        options?.sessionMetadata?.plan_name ??
        expanded.metadata?.plan_name,
    });

    logSyncResult(
      eventType,
      {
        customerId: getStripeCustomerId(expanded.customer),
        subscriptionId: expanded.id,
        workspaceId: context.workspaceId,
        priceId: result.priceId,
        planName: result.planName,
        status: result.status,
      },
      result
    );

    return result;
  } catch (error) {
    logSyncResult(
      eventType,
      {
        customerId: getStripeCustomerId(expanded.customer),
        subscriptionId: expanded.id,
        workspaceId: context.workspaceId,
        priceId: null,
        planName: options?.planNameOverride ?? null,
        status: expanded.status,
      },
      null,
      error
    );
    throw error;
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const customerId = getStripeCustomerId(session.customer);

  console.log("[Stripe webhook] checkout.session.completed received", {
    sessionId: session.id,
    subscriptionId: subscriptionId ?? null,
    customerId,
    metadata: session.metadata ?? null,
  });

  if (!subscriptionId) {
    if (customerId && session.metadata?.workspace_id && session.metadata?.user_id) {
      await reconcileWorkspaceSubscriptionFromStripe(
        session.metadata.workspace_id,
        session.metadata.user_id
      );
    }
    return;
  }

  const stripe = getStripe();
  const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["subscription", "subscription.items.data.price"],
  });

  const resolvedSubscriptionId =
    typeof fullSession.subscription === "string"
      ? fullSession.subscription
      : fullSession.subscription?.id;

  if (!resolvedSubscriptionId) {
    console.warn("[Stripe webhook] checkout session missing subscription after retrieve", {
      sessionId: session.id,
    });
    return;
  }

  const subscription =
    typeof fullSession.subscription === "object" && fullSession.subscription
      ? fullSession.subscription
      : await retrieveStripeSubscription(resolvedSubscriptionId);

  await syncSubscriptionEvent("checkout.session.completed", subscription, {
    sessionMetadata: fullSession.metadata,
    stripeCustomerId: customerId,
    planNameOverride: fullSession.metadata?.plan_name,
  });
}

async function handleSubscriptionLifecycle(
  eventType: string,
  subscription: Stripe.Subscription
): Promise<void> {
  await syncSubscriptionEvent(eventType, subscription, {
    planNameOverride: subscription.metadata?.plan_name,
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log("[Stripe webhook] customer.subscription.deleted", {
    subscriptionId: subscription.id,
    customerId: getStripeCustomerId(subscription.customer),
  });

  await markSubscriptionCanceled(subscription.id);
}

async function handleInvoiceEvent(
  eventType: string,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  console.log("[Stripe webhook] invoice event", {
    eventType,
    invoiceId: invoice.id,
    subscriptionId,
    status: invoice.status,
  });

  if (!subscriptionId) {
    return;
  }

  const subscription = await retrieveStripeSubscription(subscriptionId);
  await syncSubscriptionEvent(eventType, subscription);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

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
    console.error("[Stripe webhook] signature verification failed", {
      error: error instanceof Error ? error.message : error,
      hasSecret: Boolean(webhookSecret),
    });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (await isStripeWebhookEventProcessed(event.id)) {
    console.log("[Stripe webhook] duplicate event skipped", {
      id: event.id,
      type: event.type,
    });
    return NextResponse.json({ received: true, duplicate: true });
  }

  console.log("[Stripe webhook] event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionLifecycle(
          event.type,
          event.data.object as Stripe.Subscription
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        await handleInvoiceEvent(event.type, event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }

    await markStripeWebhookEventProcessed(event.id, event.type);
  } catch (error) {
    console.error("[Stripe webhook] handler error", {
      type: event.type,
      error,
    });
    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
