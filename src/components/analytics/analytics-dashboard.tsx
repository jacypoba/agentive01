"use client";

import { AiInsightsPanel } from "@/components/analytics/ai-insights-panel";
import { AnalyticsKpiGrid } from "@/components/analytics/analytics-kpi-grid";
import { ConversionFunnelChart } from "@/components/analytics/charts/conversion-funnel-chart";
import { DistributionChart } from "@/components/analytics/charts/distribution-chart";
import { HorizontalBarChart } from "@/components/analytics/charts/horizontal-bar-chart";
import { TimeSeriesChart } from "@/components/analytics/charts/time-series-chart";
import type { AnalyticsDashboardData } from "@/lib/analytics/types";

type AnalyticsDashboardProps = {
  data: AnalyticsDashboardData;
};

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      <AnalyticsKpiGrid kpis={data.kpis} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AiInsightsPanel insights={data.insights} />
        </div>
        <DistributionChart
          title="Preferred languages"
          description="Lead language mix from WhatsApp conversations."
          data={data.languageDistribution}
          emptyMessage="Language preferences appear after multilingual leads arrive."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TimeSeriesChart
          title="Leads over time"
          description={data.range.label}
          data={data.leadsOverTime}
          valueLabel="Leads"
        />
        <TimeSeriesChart
          title="Visits over time"
          description={data.range.label}
          data={data.visitsOverTime}
          color="#FBBF24"
          valueLabel="Visits"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionFunnelChart data={data.conversionFunnel} />
        <HorizontalBarChart
          title="Top cities"
          description="Demand and inventory concentration."
          data={data.topCities}
          emptyMessage="City trends appear once leads or listings include locations."
        />
      </div>

      <DistributionChart
        title="Property type distribution"
        description="Lead preferences and catalog inventory mix."
        data={data.propertyTypeDistribution}
        emptyMessage="Property types appear once leads specify preferences or listings exist."
      />
    </div>
  );
}
