import {
  aggregateLanguageDistribution,
  aggregatePropertyTypeDistribution,
  aggregateTopCities,
  bucketRowsByDay,
  buildConversionFunnel,
  countQualifiedLeads,
} from "@/lib/analytics/aggregate";
import { buildAnalyticsDateRange } from "@/lib/analytics/date-ranges";
import { generateAnalyticsInsights } from "@/lib/analytics/insights";
import {
  countInboundWhatsAppMessages,
  fetchAllLeadRowsForFunnel,
  fetchAllVisitRowsForFunnel,
  fetchFollowUpAnalyticsRows,
  fetchLeadAnalyticsRows,
  fetchPropertyAnalyticsRows,
  fetchVisitAnalyticsRows,
} from "@/lib/analytics/queries";
import type { AnalyticsDashboardData, AnalyticsKpi } from "@/lib/analytics/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const DEFAULT_RANGE_DAYS = 30;

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
    },
    {
      id: "conversion",
      label: "Qualification rate",
      value: `${input.conversionRate}%`,
      change: "Qualified ÷ total pipeline",
      accent: "text-white",
    },
    {
      id: "visits",
      label: "Visit requests",
      value: String(input.visits),
      change: `${input.confirmedVisits} confirmed`,
      accent: "text-amber-300",
    },
    {
      id: "whatsapp",
      label: "WhatsApp inbound",
      value: String(input.whatsappInbound),
      change: "Client messages received",
      accent: "text-emerald-300",
    },
    {
      id: "follow-ups",
      label: "Follow-ups sent",
      value: String(input.followUpsSent),
      change: "Automated re-engagement",
      accent: "text-[#00D4FF]",
    },
    {
      id: "properties",
      label: "Active listings",
      value: String(input.properties),
      change: "Catalog inventory",
      accent: "text-white",
    },
  ];
}

export async function getAnalyticsDashboardData(
  supabase: Client,
  userId: string,
  days = DEFAULT_RANGE_DAYS
): Promise<AnalyticsDashboardData> {
  const range = buildAnalyticsDateRange(days);

  const [
    leadRows,
    allLeadRows,
    allVisitRows,
    visitRows,
    followUpRows,
    propertyRows,
    whatsappInbound,
  ] = await Promise.all([
    fetchLeadAnalyticsRows(supabase, userId, range),
    fetchAllLeadRowsForFunnel(supabase, userId),
    fetchAllVisitRowsForFunnel(supabase, userId),
    fetchVisitAnalyticsRows(supabase, userId, range),
    fetchFollowUpAnalyticsRows(supabase, userId, range),
    fetchPropertyAnalyticsRows(supabase, userId),
    countInboundWhatsAppMessages(supabase, userId, range),
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
    totalLeads: allLeadRows.length,
    qualifiedLeads: countQualifiedLeads(allLeadRows),
    visitRequestedLeads: allLeadRows.filter((row) => row.visit_requested).length,
    confirmedVisits: allVisitRows.filter((row) => row.status === "confirmed")
      .length,
    closedLeads: allLeadRows.filter((row) => row.status === "closed").length,
  });

  const languageDistribution = aggregateLanguageDistribution(leadRows);
  const propertyTypeDistribution = aggregatePropertyTypeDistribution(
    leadRows,
    propertyRows
  );
  const topCities = aggregateTopCities(leadRows, propertyRows);

  const totals = {
    leads: leadRows.length,
    visits: visitRows.length,
    followUpsSent,
    whatsappInbound,
    properties: propertyRows.length,
    conversionRate,
  };

  const snapshot = {
    tenant: { userId },
    range,
    kpis: buildAnalyticsKpis({
      leads: leadRows.length,
      visits: visitRows.length,
      confirmedVisits,
      followUpsSent,
      whatsappInbound,
      properties: propertyRows.length,
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
