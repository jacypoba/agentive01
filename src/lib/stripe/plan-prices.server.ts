import "server-only";
import { getPlanById, PLAN_LIST, type PlanId } from "@/lib/stripe/plans";

const PRICE_ENV_KEYS: Record<PlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

/** Reads Stripe price IDs from server environment (never available on the client). */
export function getStripePriceId(planId: PlanId): string | null {
  const value = process.env[PRICE_ENV_KEYS[planId]]?.trim();
  return value || null;
}

export function areAllStripePricesConfigured(): boolean {
  return PLAN_LIST.every((plan) => Boolean(getStripePriceId(plan.id)));
}

export function getConfiguredPlanIds(): PlanId[] {
  return PLAN_LIST.filter((plan) => Boolean(getStripePriceId(plan.id))).map(
    (plan) => plan.id
  );
}

export function getPlanByPriceId(
  priceId: string | null | undefined
): ReturnType<typeof getPlanById> | null {
  if (!priceId) {
    return null;
  }

  for (const plan of PLAN_LIST) {
    if (getStripePriceId(plan.id) === priceId) {
      return plan;
    }
  }

  return null;
}

export function getStripeEnvDiagnostics() {
  return {
    secretKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    prices: Object.fromEntries(
      PLAN_LIST.map((plan) => [
        plan.id,
        Boolean(getStripePriceId(plan.id)),
      ])
    ) as Record<PlanId, boolean>,
  };
}
