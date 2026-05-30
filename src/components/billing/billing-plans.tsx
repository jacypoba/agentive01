"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlanCard } from "@/components/billing/plan-card";
import {
  formatPlanPrice,
  PLAN_LIST,
  type PlanDefinition,
  type PlanId,
} from "@/lib/stripe/plans";

type BillingPlansProps = {
  currentPlanId: PlanId;
  checkoutEnabled: boolean;
  canManageBilling: boolean;
};

export function BillingPlans({
  currentPlanId,
  checkoutEnabled,
  canManageBilling,
}: BillingPlansProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<PlanId | null>(null);

  const planRank: Record<PlanId, number> = {
    starter: 1,
    pro: 2,
    enterprise: 3,
  };

  async function startCheckout(planId: PlanId) {
    if (!canManageBilling) {
      setError("Only workspace owners and admins can change plans.");
      return;
    }

    if (!checkoutEnabled) {
      setError(
        "Checkout is not configured. Add Stripe keys and price IDs in your environment."
      );
      return;
    }

    setError(null);
    setLoadingPlanId(planId);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      let payload: { url?: string; error?: string } = {};
      try {
        payload = (await response.json()) as { url?: string; error?: string };
      } catch {
        payload = {};
      }

      if (!response.ok) {
        setError(
          payload.error ??
            `Checkout failed (${response.status}). Check server logs for details.`
        );
        return;
      }

      if (!payload.url) {
        setError("Stripe did not return a checkout URL.");
        return;
      }

      window.location.assign(payload.url);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Network error while starting checkout."
      );
    } finally {
      setLoadingPlanId(null);
    }
  }

  async function openPortal() {
    if (!canManageBilling) {
      setError("Only workspace owners and admins can manage billing.");
      return;
    }

    if (!checkoutEnabled) {
      setError(
        "Billing portal is not configured. Add Stripe keys in your environment."
      );
      return;
    }

    setError(null);
    setPortalLoading(true);

    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      let payload: { url?: string; error?: string } = {};
      try {
        payload = (await response.json()) as { url?: string; error?: string };
      } catch {
        payload = {};
      }

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not open billing portal.");
        return;
      }

      window.location.assign(payload.url);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Network error while opening billing portal."
      );
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/45">
          Choose a plan to subscribe after your trial. All billing runs in Stripe
          test mode.
        </p>
        <button
          type="button"
          onClick={openPortal}
          disabled={portalLoading || !checkoutEnabled || !canManageBilling}
          className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {portalLoading ? "Opening…" : "Manage billing"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {PLAN_LIST.map((plan: PlanDefinition) => {
          const isCurrent = plan.id === currentPlanId;
          const isUpgrade = planRank[plan.id] > planRank[currentPlanId];

          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              priceLabel={formatPlanPrice(plan)}
              isCurrent={isCurrent}
              isUpgrade={isUpgrade}
              loading={loadingPlanId === plan.id}
              disabled={!checkoutEnabled || !canManageBilling}
              onSelect={startCheckout}
            />
          );
        })}
      </div>

      <p className="text-center text-xs text-white/30">
        Need help choosing?{" "}
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-white/50 underline-offset-2 hover:text-white hover:underline"
        >
          Refresh subscription status
        </button>
      </p>
    </div>
  );
}
