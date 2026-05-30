import { NextResponse } from "next/server";
import {
  BillingAccessError,
  resolveBillingScope,
} from "@/lib/billing/workspace-subscription";
import { getAppUrl } from "@/lib/stripe/app-url";
import { getStripe } from "@/lib/stripe/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe/get-or-create-customer";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { workspaceId, subscription } = await resolveBillingScope(
      supabase,
      user.id
    );

    let customerId = subscription?.stripe_customer_id ?? null;

    if (!customerId) {
      customerId = await getOrCreateStripeCustomer({
        workspaceId,
        userId: user.id,
        email: user.email ?? "",
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
      });
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/billing`,
    });

    console.log("[Stripe portal]", {
      userId: user.id,
      workspaceId,
      customerId,
      hasStripeSubscription: Boolean(subscription?.stripe_subscription_id),
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    if (error instanceof BillingAccessError) {
      console.warn("[Stripe portal] billing access denied", {
        error: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("[Stripe portal]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create billing portal session.",
      },
      { status: 500 }
    );
  }
}
