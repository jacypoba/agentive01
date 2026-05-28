import {
  ensureTrialSubscription,
  getSubscriptionByWorkspaceId,
  updateSubscriptionCustomerId,
} from "@/lib/billing/subscriptions";
import { TRIAL_DAYS } from "@/lib/stripe/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

export async function getOrCreateStripeCustomer(input: {
  workspaceId: string;
  userId: string;
  email: string;
  name?: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  let existing = await getSubscriptionByWorkspaceId(admin, input.workspaceId);

  if (!existing) {
    existing = await ensureTrialSubscription(
      input.workspaceId,
      input.userId,
      TRIAL_DAYS
    );
  }

  if (existing.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name ?? undefined,
    metadata: {
      workspace_id: input.workspaceId,
      user_id: input.userId,
    },
  });

  if (existing) {
    await updateSubscriptionCustomerId(input.workspaceId, customer.id);
  }

  return customer.id;
}
