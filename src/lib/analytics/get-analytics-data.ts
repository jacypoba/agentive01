import {
  aggregateLanguageDistribution,
  aggregatePropertyTypeDistribution,
  aggregateTopCities,
  bucketRowsByDay,
  buildConversionFunnel,
  countQualifiedLeads,
} from "@/lib/analytics/aggregate";
import { buildAnalyticsDateRangeForPeriod } from "@/lib/analytics/date-ranges";
import { generateAnalyticsInsights } from "@/lib/analytics/insights";
import {
  DEFAULT_ANALYTICS_PERIOD,
  type AnalyticsPeriodKey,
} from "@/lib/analytics/periods";
import {
  countInboundWhatsAppMessages,
  fetchFollowUpAnalyticsRows,
  fetchLeadAnalyticsRows,
  fetchPropertyAnalyticsRows,
  fetchVisitAnalyticsRows,
} from "@/lib/analytics/queries";
import type { AnalyticsDashboardData, AnalyticsKpi } from "@/lib/analytics/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

function buildAnalyticsKpis(input: {
  leads: number;
  visits: number;
  confirmedVisits: number;
  followUpsSent: number;
  whatsappInbound: number;
  properties: number;
  conversionRate: number;
  rangeLabel: string;
}): AnalyticsKpi[] {
  return [
    {
      id: "leads",
      label: "New leads",
      value: String(input.leads),
      change: input.rangeLabel,
      accent: "text-[#00D4FF]",
      href: "/leads",
    },
    {
      id: "conversion",
      label: "Qualification rate",
      value: `${input.conversionRate}%`,
      change: "Qualified ÷ leads in period",
      accent: "text-white",
      href: "/leads?status=qualified",
    },
    {
      id: "visits",
      label: "Visit requests",
      value: String(input.visits),
      change: `${input.confirmedVisits} confirmed`,
      accent: "text-amber-300",
      href: "/visits",
    },
    {
      id: "whatsapp",
      label: "WhatsApp inbound",
      value: String(input.whatsappInbound),
      change: "Client messages received",
      accent: "text-emerald-300",
      href: "/leads",
    },
    {
      id: "follow-ups",
      label: "Follow-ups sent",
      value: String(input.followUpsSent),
      change: "Automated re-engagement",
      accent: "text-[#00D4FF]",
      href: "/follow-ups?group=sent",
    },
    {
      id: "properties",
      label: "Active listings",
      value: String(input.properties),
      change: "Total catalog inventory",
      accent: "text-white",
      href: "/properties",
    },
  ];
}

export async function getAnalyticsDashboardData(
  supabase: Client,
  userId: string,
  workspaceId: string,
  period: AnalyticsPeriodKey = DEFAULT_ANALYTICS_PERIOD
): Promise<AnalyticsDashboardData> {
  const range = buildAnalyticsDateRangeForPeriod(period);

  const [
    leadRows,
    visitRows,
    followUpRows,
    propertyRowsInRange,
    totalPropertyRows,
    whatsappInbound,
  ] = await Promise.all([
    fetchLeadAnalyticsRows(supabase, workspaceId, range),
    fetchVisitAnalyticsRows(supabase, workspaceId, range),
    fetchFollowUpAnalyticsRows(supabase, workspaceId, range),
    fetchPropertyAnalyticsRows(supabase, workspaceId, range),
    fetchPropertyAnalyticsRows(supabase, workspaceId),
    countInboundWhatsAppMessages(supabase, workspaceId, range),
  ]);

  const qualifiedInRange = countQualifiedLeads(leadRows);
  const conversionRate =
    leadRows.length > 0
      ? Math.round((qualifiedInRange / leadRows.length) * 100)
      : 0;

  const confirmedVisits = visitRows.filter(
    (row) => row.status === "confirmed"
  ).length;

  const followUpsSent = followUpRows.filter(
    (row) => row.status === "sent"
  ).length;

  const conversionFunnel = buildConversionFunnel({
    totalLeads: leadRows.length,
    qualifiedLeads: qualifiedInRange,
    visitRequestedLeads: leadRows.filter((row) => row.visit_requested).length,
    confirmedVisits,
    closedLeads: leadRows.filter((row) => row.status === "closed").length,
  });

  const languageDistribution = aggregateLanguageDistribution(leadRows);
  const propertyTypeDistribution = aggregatePropertyTypeDistribution(
    leadRows,
    propertyRowsInRange
  );
  const topCities = aggregateTopCities(leadRows, propertyRowsInRange);

  const totals = {
    leads: leadRows.length,
    visits: visitRows.length,
    followUpsSent,
    whatsappInbound,
    properties: totalPropertyRows.length,
    conversionRate,
  };

  const snapshot = {
    tenant: { userId, workspaceId },
    range,
    kpis: buildAnalyticsKpis({
      leads: leadRows.length,
      visits: visitRows.length,
      confirmedVisits,
      followUpsSent,
      whatsappInbound,
      properties: totalPropertyRows.length,
      conversionRate,
      rangeLabel: range.label,
    }),
    leadsOverTime: bucketRowsByDay(leadRows, range),
    visitsOverTime: bucketRowsByDay(visitRows, range),
    conversionFunnel,
    languageDistribution,
    propertyTypeDistribution,
    topCities,
    insights: [],
    totals,
  };

  return {
    ...snapshot,
    insights: generateAnalyticsInsights(snapshot),
  };
}
