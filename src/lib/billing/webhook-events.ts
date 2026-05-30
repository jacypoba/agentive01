import { createAdminClient } from "@/lib/supabase/admin";

export async function isStripeWebhookEventProcessed(
  eventId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stripe_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .limit(1);

  if (error) {
    console.warn("[Stripe webhook] dedup lookup failed", {
      eventId,
      error: error.message,
    });
    return false;
  }

  return Boolean(data?.length);
}

export async function markStripeWebhookEventProcessed(
  eventId: string,
  eventType: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("stripe_webhook_events").upsert(
    {
      event_id: eventId,
      event_type: eventType,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "event_id" }
  );

  if (error) {
    console.warn("[Stripe webhook] dedup write failed", {
      eventId,
      eventType,
      error: error.message,
    });
  }
}

export async function updateSubscriptionStatusByStripeId(
  stripeSubscriptionId: string,
  status: import("@/types/database").SubscriptionStatus
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({
      subscription_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) {
    throw new Error(`Failed to update subscription status: ${error.message}`);
  }
}
