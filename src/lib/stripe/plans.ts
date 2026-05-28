export type PlanId = "starter" | "pro" | "enterprise";

/** Client-safe plan metadata (no Stripe secrets or server env vars). */
export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  currency: "eur" | "usd";
  features: string[];
  highlighted?: boolean;
};

const DEFAULT_TRIAL_DAYS = 14;

export const TRIAL_DAYS = DEFAULT_TRIAL_DAYS;

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "For solo agents getting started with AI lead qualification.",
    priceMonthly: 49,
    currency: "eur",
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

export function formatPlanPrice(plan: PlanDefinition): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(plan.priceMonthly);
}
