import type { Metadata } from "next";
import { BillingPlans } from "@/components/billing/billing-plans";
import { BillingStatus } from "@/components/billing/billing-status";
import { getCurrentSubscription } from "@/lib/billing/get-current-subscription";
import { isStripeTestMode } from "@/lib/stripe";
import { areAllStripePricesConfigured } from "@/lib/stripe/plan-prices.server";
import { reconcileWorkspaceSubscriptionFromStripe } from "@/lib/stripe/sync-subscription";
import { getCurrentWorkspaceId } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Billing — Agentive01",
  description: "Manage your Agentive01 subscription and plan.",
};

type BillingPageProps = {
  searchParams: Promise<{ success?: string; canceled?: string }>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscription = null;
  let loadError: string | null = null;
  let reconciledAfterCheckout = false;

  if (user) {
    try {
      const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
      if (workspaceId) {
        if (params.success === "1") {
          try {
            const reconciled = await reconcileWorkspaceSubscriptionFromStripe(
              workspaceId,
              user.id
            );
            reconciledAfterCheckout = Boolean(reconciled);
          } catch (reconcileError) {
            console.error("[Billing] post-checkout reconcile failed", reconcileError);
          }
        }

        subscription = await getCurrentSubscription(
          supabase,
          workspaceId,
          user.id
        );
      } else {
        loadError = "No workspace found for your account.";
      }
    } catch (error) {
      loadError =
        error instanceof Error
          ? error.message
          : "Could not load subscription.";
    }
  }

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const pricesConfigured = areAllStripePricesConfigured();
  const checkoutEnabled = stripeConfigured && pricesConfigured;

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="animate-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
            Billing
            {isStripeTestMode() && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Test mode
              </span>
            )}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Plans &amp; billing
          </h1>
          <p className="mt-3 max-w-2xl text-white/50">
            Upgrade your workspace when you are ready. Subscriptions are managed
            securely through Stripe.
          </p>
        </section>

        {params.success === "1" && (
          <div
            role="status"
            className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {reconciledAfterCheckout
              ? "Payment successful. Your subscription is now active."
              : "Payment successful. Your subscription will update shortly."}
          </div>
        )}

        {params.canceled === "1" && (
          <div
            role="status"
            className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50"
          >
            Checkout canceled. No changes were made.
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            {loadError}
          </div>
        )}

        {!stripeConfigured && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            Stripe is not configured. Add STRIPE_SECRET_KEY and price IDs to
            enable checkout.
          </div>
        )}

        {stripeConfigured && !pricesConfigured && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            Set STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, and
            STRIPE_PRICE_ENTERPRISE in your environment.
          </div>
        )}

        {subscription && (
          <div className="mt-10">
            <BillingStatus subscription={subscription} />
          </div>
        )}

        <section className="mt-10">
          <h2 className="mb-6 text-lg font-semibold text-white">
            Available plans
          </h2>
          <BillingPlans
            currentPlanId={subscription?.plan_name ?? "starter"}
            checkoutEnabled={checkoutEnabled}
          />
        </section>
      </div>
    </main>
  );
}
