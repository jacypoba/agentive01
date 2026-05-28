import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton";
import { getAnalyticsDashboardData } from "@/lib/analytics/get-analytics-data";
import { createClient } from "@/lib/supabase/server";

type AnalyticsSectionProps = {
  userId: string;
};

async function AnalyticsSectionContent({ userId }: AnalyticsSectionProps) {
  const supabase = await createClient();
  const data = await getAnalyticsDashboardData(supabase, userId);

  return <AnalyticsDashboard data={data} />;
}

export function AnalyticsSection({ userId }: AnalyticsSectionProps) {
  return (
    <section className="mt-14">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
      </div>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsSectionContent userId={userId} />
      </Suspense>
    </section>
  );
}
