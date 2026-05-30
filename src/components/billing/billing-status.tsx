import type { CurrentSubscription } from "@/types/database";
import { formatPlanPrice, getPlanById } from "@/lib/stripe/plans";

type BillingStatusProps = {
  subscription: CurrentSubscription;
  canManageBilling: boolean;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusPresentation(subscription: CurrentSubscription): {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
} {
  const status = subscription.subscription_status;

  if (status === "trialing") {
    return { label: "Free trial", tone: "success" };
  }

  if (status === "active") {
    return { label: "Active", tone: "success" };
  }

  if (status === "past_due") {
    return { label: "Past due — update payment", tone: "warning" };
  }

  if (status === "canceled") {
    return { label: "Canceled", tone: "danger" };
  }

  if (status === "unpaid") {
    return { label: "Unpaid", tone: "danger" };
  }

  return {
    label: status.replace(/_/g, " "),
    tone: "neutral",
  };
}

const toneClasses = {
  neutral: "text-white/60",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-rose-300",
};

export function BillingStatus({
  subscription,
  canManageBilling,
}: BillingStatusProps) {
  const plan = getPlanById(subscription.plan_name);
  const { label: statusLabel, tone } = statusPresentation(subscription);
  const hasStripeSubscription = Boolean(subscription.stripe_subscription_id);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/35">
            Current subscription
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{plan.name}</p>
          <p className="mt-1 text-sm text-white/45">
            {formatPlanPrice(plan)} / month ·{" "}
            <span className={`capitalize ${toneClasses[tone]}`}>
              {statusLabel}
            </span>
          </p>
          {!canManageBilling && (
            <p className="mt-2 text-xs text-white/35">
              Billing is managed by a workspace owner or admin.
            </p>
          )}
        </div>

        <div className="grid gap-3 text-sm sm:text-right">
          {subscription.isTrialing && subscription.daysLeftInTrial != null && (
            <p className="text-[#00D4FF]">
              {subscription.daysLeftInTrial} day
              {subscription.daysLeftInTrial === 1 ? "" : "s"} left in trial
            </p>
          )}
          {subscription.trial_ends_at && subscription.isTrialing && (
            <p className="text-white/40">
              Trial ends {formatDate(subscription.trial_ends_at)}
            </p>
          )}
          {subscription.current_period_end && !subscription.isTrialing && (
            <p className="text-white/40">
              {subscription.subscription_status === "canceled"
                ? "Access until"
                : "Renews"}{" "}
              {formatDate(subscription.current_period_end)}
            </p>
          )}
          {hasStripeSubscription && (
            <p className="text-xs text-white/30">
              Stripe subscription linked
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
