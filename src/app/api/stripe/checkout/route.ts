import { NextResponse } from "next/server";
import { getOrCreateStripeCustomer } from "@/lib/stripe/get-or-create-customer";
import { getAppUrl } from "@/lib/stripe/app-url";
import { getStripe } from "@/lib/stripe/client";
import { getPlanById, type PlanId } from "@/lib/stripe/plans";
import { getCurrentWorkspaceId } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as { planId?: PlanId };
    const planId = body.planId ?? "starter";
    const plan = getPlanById(planId);

    if (!plan.stripePriceId) {
      return NextResponse.json(
        {
          error: `Stripe price not configured for ${plan.name}. Set STRIPE_PRICE_${planId.toUpperCase()}.`,
        },
        { status: 503 }
      );
    }

    const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No workspace found for this account." },
        { status: 400 }
      );
    }

    const customerId = await getOrCreateStripeCustomer({
      workspaceId,
      userId: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    });

    const stripe = getStripe();
    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?canceled=1`,
      allow_promotion_codes: true,
      metadata: {
        workspace_id: workspaceId,
        user_id: user.id,
        plan_name: plan.id,
      },
      subscription_data: {
        metadata: {
          workspace_id: workspaceId,
          user_id: user.id,
          plan_name: plan.id,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe checkout]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session.",
      },
      { status: 500 }
    );
  }
}
