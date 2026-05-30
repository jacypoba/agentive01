import type { CurrentSubscription, PlanName } from "@/types/database";
import {
  formatLimitValue,
  getPlanLimits,
  type PlanLimits,
} from "@/lib/billing/plan-limits";

type BillingPlanLimitsProps = {
  planName: PlanName;
  subscription: CurrentSubscription;
  usage?: {
    leads?: number;
    properties?: number;
  };
};

function limitRow(label: string, value: string) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="font-medium text-white/80">{value}</span>
    </div>
  );
}

function usageRow(label: string, current: number | undefined, limit: number | null) {
  if (limit == null) {
    return limitRow(label, current != null ? `${current.toLocaleString("en-GB")} / Unlimited` : "Unlimited");
  }

  const currentLabel = current != null ? current.toLocaleString("en-GB") : "—";
  return limitRow(label, `${currentLabel} / ${formatLimitValue(limit)}`);
}

function featureRow(label: string, enabled: boolean) {
  return limitRow(label, enabled ? "Included" : "Not included");
}

export function BillingPlanLimits({
  planName,
  subscription,
  usage,
}: BillingPlanLimitsProps) {
  const limits: PlanLimits = getPlanLimits(planName);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-white/35">
        Plan limits
      </p>
      <p className="mt-2 text-sm text-white/45">
        Usage and entitlements for your workspace on the{" "}
        <span className="capitalize text-white/70">{planName}</span> plan.
      </p>

      <div className="mt-5 divide-y divide-white/5">
        {usageRow("Leads", usage?.leads, limits.maxLeads)}
        {usageRow("Properties", usage?.properties, limits.maxProperties)}
        {limitRow("WhatsApp connections", String(limits.maxWhatsAppConnections))}
        {limitRow("Team members", String(limits.maxTeamMembers))}
        {limitRow(
          "Follow-ups per lead",
          limits.maxFollowUpsPerLead > 0
            ? String(limits.maxFollowUpsPerLead)
            : "Not included"
        )}
        {limitRow(
          "AI replies / month",
          formatLimitValue(limits.maxAiRepliesPerMonth)
        )}
        {featureRow("Follow-up automation", limits.followUpsEnabled)}
        {featureRow("Analytics", limits.analyticsEnabled)}
        {featureRow("Google Calendar sync", limits.calendarSyncEnabled)}
        {featureRow("AI assistant", limits.aiAssistantEnabled)}
      </div>

      {subscription.subscription_status === "past_due" && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Payment is past due. Update your payment method in the billing portal to
          avoid service interruption.
        </p>
      )}

      {subscription.subscription_status === "canceled" && (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Subscription canceled. Upgrade to restore premium features.
        </p>
      )}
    </div>
  );
}
