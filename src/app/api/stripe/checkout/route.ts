import { NextResponse } from "next/server";
import {
  BillingAccessError,
  resolveBillingScope,
} from "@/lib/billing/workspace-subscription";
import { getOrCreateStripeCustomer } from "@/lib/stripe/get-or-create-customer";
import { getAppUrl } from "@/lib/stripe/app-url";
import { getStripe } from "@/lib/stripe/client";
import {
  getStripeEnvDiagnostics,
  getStripePriceId,
} from "@/lib/stripe/plan-prices.server";
import { getPlanById, type PlanId } from "@/lib/stripe/plans";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let planId: PlanId = "starter";

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log("[Stripe checkout] unauthorized");
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as { planId?: PlanId };
    planId = body.planId ?? "starter";
    const plan = getPlanById(planId);
    const stripePriceId = getStripePriceId(planId);
    const envDiagnostics = getStripeEnvDiagnostics();

    const { workspaceId } = await resolveBillingScope(supabase, user.id);

    console.log("[Stripe checkout]", {
      userId: user.id,
      selectedPlan: planId,
      priceIdExists: Boolean(stripePriceId),
      workspaceId,
      sessionUrlExists: false,
      env: envDiagnostics,
    });

    if (!stripePriceId) {
      return NextResponse.json(
        {
          error: `Stripe price not configured for ${plan.name}. Set ${PRICE_ENV_LABEL[planId]}.`,
        },
        { status: 503 }
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
      line_items: [{ price: stripePriceId, quantity: 1 }],
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

    console.log("[Stripe checkout]", {
      userId: user.id,
      selectedPlan: planId,
      priceIdExists: true,
      workspaceId,
      sessionUrlExists: Boolean(session.url),
      sessionId: session.id,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof BillingAccessError) {
      console.warn("[Stripe checkout] billing access denied", {
        planId,
        error: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("[Stripe checkout] failed", { planId, error });
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

const PRICE_ENV_LABEL: Record<PlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};
