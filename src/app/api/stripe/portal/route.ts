import { NextResponse } from "next/server";
import { getSubscriptionByWorkspaceId } from "@/lib/billing/subscriptions";
import { getAppUrl } from "@/lib/stripe/app-url";
import { getStripe } from "@/lib/stripe/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe/get-or-create-customer";
import { getCurrentWorkspaceId } from "@/lib/workspaces/get-current-workspace";
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

    const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No workspace found for this account." },
        { status: 400 }
      );
    }

    let subscription = await getSubscriptionByWorkspaceId(supabase, workspaceId);
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

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
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
