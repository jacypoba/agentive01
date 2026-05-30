import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { AnalyticsPeriodSelector } from "@/components/analytics/analytics-period-selector";
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton";
import { getAnalyticsDashboardData } from "@/lib/analytics/get-analytics-data";
import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import { createClient } from "@/lib/supabase/server";

type AnalyticsSectionProps = {
  userId: string;
  workspaceId: string;
  period: AnalyticsPeriodKey;
};

async function AnalyticsSectionContent({
  userId,
  workspaceId,
  period,
}: AnalyticsSectionProps) {
  const supabase = await createClient();
  const data = await getAnalyticsDashboardData(
    supabase,
    userId,
    workspaceId,
    period
  );

  return <AnalyticsDashboard data={data} />;
}

export function AnalyticsSection({
  userId,
  workspaceId,
  period,
}: AnalyticsSectionProps) {
  return (
    <section className="mt-14">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#00D4FF]">
            Analytics · Phase 1
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            Pipeline intelligence
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            CRM, WhatsApp, visits, and follow-up performance — scoped to your
            workspace and ready for future billing analytics.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-9 w-full max-w-md animate-pulse rounded-xl border border-white/10 bg-white/[0.03] sm:w-80" />
          }
        >
          <AnalyticsPeriodSelector activePeriod={period} />
        </Suspense>
      </div>

      <Suspense key={period} fallback={<AnalyticsSkeleton />}>
        <AnalyticsSectionContent
          userId={userId}
          workspaceId={workspaceId}
          period={period}
        />
      </Suspense>
    </section>
  );
}
