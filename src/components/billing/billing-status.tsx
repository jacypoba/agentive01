import type { CurrentSubscription } from "@/types/database";
import { formatPlanPrice, getPlanById } from "@/lib/stripe/plans";

type BillingStatusProps = {
  subscription: CurrentSubscription;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function BillingStatus({ subscription }: BillingStatusProps) {
  const plan = getPlanById(subscription.plan_name);

  const statusLabel =
    subscription.subscription_status === "trialing"
      ? "Free trial"
      : subscription.subscription_status.replace(/_/g, " ");

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
            <span className="capitalize text-white/60">{statusLabel}</span>
          </p>
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
              Renews {formatDate(subscription.current_period_end)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
