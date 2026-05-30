import type Stripe from "stripe";
import type { Subscription } from "@/types/database";

export type WebhookWorkspaceContext = {
  workspaceId: string;
  userId: string;
};

/**
 * Resolves workspace/user for Stripe webhook sync from session metadata,
 * subscription metadata, existing DB row, or Stripe customer lookup.
 */
export function resolveWebhookWorkspaceContext(input: {
  subscription: Stripe.Subscription;
  sessionMetadata?: Stripe.Metadata | null;
  existingSubscription?: Subscription | null;
  customerLookup?: WebhookWorkspaceContext | null;
}): WebhookWorkspaceContext | null {
  const { subscription, sessionMetadata, existingSubscription, customerLookup } =
    input;

  const workspaceId =
    sessionMetadata?.workspace_id ?? subscription.metadata?.workspace_id;
  const userId = sessionMetadata?.user_id ?? subscription.metadata?.user_id;

  if (workspaceId && userId) {
    return { workspaceId, userId };
  }

  if (existingSubscription) {
    return {
      workspaceId: existingSubscription.workspace_id,
      userId: existingSubscription.user_id,
    };
  }

  return customerLookup ?? null;
}

export function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const legacy = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    }
  ).subscription;

  if (typeof legacy === "string") {
    return legacy;
  }

  if (legacy && typeof legacy === "object" && "id" in legacy) {
    return legacy.id;
  }

  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") {
    return parentSub;
  }

  return parentSub?.id ?? null;
}

export function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer || typeof customer === "string") {
    return customer;
  }

  if ("deleted" in customer && customer.deleted) {
    return null;
  }

  return customer.id;
}
