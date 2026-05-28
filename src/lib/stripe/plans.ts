export type PlanId = "starter" | "pro" | "enterprise";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  currency: "eur" | "usd";
  stripePriceId: string | null;
  features: string[];
  highlighted?: boolean;
};

const DEFAULT_TRIAL_DAYS = 14;

export const TRIAL_DAYS = DEFAULT_TRIAL_DAYS;

/** Plan catalog — map STRIPE_PRICE_* env vars to Stripe test-mode price IDs. */
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "For solo agents getting started with AI lead qualification.",
    priceMonthly: 49,
    currency: "eur",
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? null,
    features: [
      "1 workspace",
      "WhatsApp AI assistant",
      "Lead pipeline",
      "Visit scheduling",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For growing agencies that need automation at scale.",
    priceMonthly: 99,
    currency: "eur",
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    highlighted: true,
    features: [
      "Everything in Starter",
      "Follow-up automation",
      "Analytics dashboard",
      "Google Calendar sync",
      "Priority support",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "For teams with advanced workflows and custom needs.",
    priceMonthly: 249,
    currency: "eur",
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    features: [
      "Everything in Pro",
      "Multi-workspace ready",
      "Dedicated onboarding",
      "Custom integrations",
      "SLA & account manager",
    ],
  },
};

export const PLAN_LIST: PlanDefinition[] = Object.values(PLANS);

export function getPlanById(planId: string | null | undefined): PlanDefinition {
  if (planId && planId in PLANS) {
    return PLANS[planId as PlanId];
  }

  return PLANS.starter;
}

export function getPlanByPriceId(
  priceId: string | null | undefined
): PlanDefinition | null {
  if (!priceId) {
    return null;
  }

  return PLAN_LIST.find((plan) => plan.stripePriceId === priceId) ?? null;
}

export function formatPlanPrice(plan: PlanDefinition): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(plan.priceMonthly);
}
