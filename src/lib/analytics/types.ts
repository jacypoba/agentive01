import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";

/** Analytics domain types — scoped per tenant via userId (future Stripe org mapping). */

export type AnalyticsTenantScope = {
  userId: string;
};

export type AnalyticsDateRange = {
  label: string;
  period: AnalyticsPeriodKey;
  days: number | null;
  start: string | null;
  end: string | null;
  allTime: boolean;
};

export type TimeSeriesPoint = {
  date: string;
  label: string;
  value: number;
};

export type DistributionPoint = {
  name: string;
  value: number;
  percentage: number;
};

export type FunnelStage = {
  stage: string;
  label: string;
  value: number;
  percentage: number;
};

export type AnalyticsKpi = {
  id: string;
  label: string;
  value: string;
  change: string;
  accent: string;
};

export type AnalyticsInsight = {
  id: string;
  tone: "positive" | "neutral" | "warning";
  title: string;
  body: string;
};

export type AnalyticsSnapshot = {
  tenant: AnalyticsTenantScope;
  range: AnalyticsDateRange;
  kpis: AnalyticsKpi[];
  leadsOverTime: TimeSeriesPoint[];
  visitsOverTime: TimeSeriesPoint[];
  conversionFunnel: FunnelStage[];
  languageDistribution: DistributionPoint[];
  propertyTypeDistribution: DistributionPoint[];
  topCities: DistributionPoint[];
  insights: AnalyticsInsight[];
  totals: {
    leads: number;
    visits: number;
    followUpsSent: number;
    whatsappInbound: number;
    properties: number;
    conversionRate: number;
  };
};

/** Placeholder for future Stripe revenue / subscription analytics. */
export type AnalyticsBillingSnapshot = {
  mrr?: number;
  activeSubscriptions?: number;
  currency?: string;
};

export type AnalyticsDashboardData = AnalyticsSnapshot & {
  billing?: AnalyticsBillingSnapshot;
};
