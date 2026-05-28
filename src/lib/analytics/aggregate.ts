import {
  buildDayKeys,
  buildDayKeysBetween,
  formatChartDayLabel,
  formatChartMonthLabel,
  startOfMonthKey,
  startOfWeekKey,
  toDayKey,
} from "@/lib/analytics/date-ranges";
import type {
  AnalyticsDateRange,
  DistributionPoint,
  FunnelStage,
  TimeSeriesPoint,
} from "@/lib/analytics/types";
import type { LeadStatus } from "@/types/database";

type TimeBucketMode = "day" | "week" | "month";

function resolveTimeBucketMode(dayCount: number): TimeBucketMode {
  if (dayCount > 180) return "month";
  if (dayCount > 60) return "week";
  return "day";
}

function bucketKeyForRow(dayKey: string, mode: TimeBucketMode): string {
  if (mode === "week") return startOfWeekKey(dayKey);
  if (mode === "month") return startOfMonthKey(dayKey);
  return dayKey;
}

function formatBucketLabel(bucketKey: string, mode: TimeBucketMode): string {
  if (mode === "month") return formatChartMonthLabel(bucketKey);
  return formatChartDayLabel(bucketKey);
}

function buildBucketKeys(
  rows: { created_at: string }[],
  range: AnalyticsDateRange
): { keys: string[]; mode: TimeBucketMode } {
  if (!range.allTime) {
    const keys = buildDayKeys(range);
    return { keys, mode: resolveTimeBucketMode(keys.length) };
  }

  if (rows.length === 0) {
    return { keys: [], mode: "day" };
  }

  const dayKeys = rows.map((row) => toDayKey(row.created_at)).sort();
  const startKey = dayKeys[0]!;
  const endKey = toDayKey(new Date().toISOString());
  const spanKeys = buildDayKeysBetween(startKey, endKey);
  const mode = resolveTimeBucketMode(spanKeys.length);

  if (mode === "day") {
    return { keys: spanKeys, mode };
  }

  const bucketKeys = new Set<string>();
  for (const dayKey of spanKeys) {
    bucketKeys.add(bucketKeyForRow(dayKey, mode));
  }

  return { keys: [...bucketKeys].sort(), mode };
}

export function bucketRowsByDay(
  rows: { created_at: string }[],
  range: AnalyticsDateRange
): TimeSeriesPoint[] {
  const { keys, mode } = buildBucketKeys(rows, range);

  if (keys.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();

  for (const row of rows) {
    const dayKey = toDayKey(row.created_at);
    const bucketKey = bucketKeyForRow(dayKey, mode);
    counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1);
  }

  return keys.map((date) => ({
    date,
    label: formatBucketLabel(date, mode),
    value: counts.get(date) ?? 0,
  }));
}

function toDistribution(
  counts: Map<string, number>,
  limit = 6
): DistributionPoint[] {
  const sorted = [...counts.entries()]
    .filter(([name]) => name.trim().length > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const total = sorted.reduce((sum, [, value]) => sum + value, 0) || 1;

  return sorted.map(([name, value]) => ({
    name,
    value,
    percentage: Math.round((value / total) * 100),
  }));
}

export function aggregateLanguageDistribution(
  rows: { preferred_language: string | null }[]
): DistributionPoint[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const lang = (row.preferred_language ?? "unknown").toLowerCase();
    const label =
      lang === "pt"
        ? "Portuguese"
        : lang === "en"
          ? "English"
          : lang === "it"
            ? "Italian"
            : lang === "es"
              ? "Spanish"
              : "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return toDistribution(counts, 5);
}

export function aggregatePropertyTypeDistribution(
  leadRows: { property_type: string | null }[],
  propertyRows: { property_type: string }[]
): DistributionPoint[] {
  const counts = new Map<string, number>();

  for (const row of leadRows) {
    const type = row.property_type?.trim();
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  for (const row of propertyRows) {
    const type = row.property_type?.trim();
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return toDistribution(counts, 6);
}

export function aggregateTopCities(
  leadRows: { preferred_area: string | null }[],
  propertyRows: { city: string }[]
): DistributionPoint[] {
  const counts = new Map<string, number>();

  for (const row of leadRows) {
    const city = row.preferred_area?.trim();
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  for (const row of propertyRows) {
    const city = row.city?.trim();
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  return toDistribution(counts, 6);
}

const QUALIFIED_STATUSES: LeadStatus[] = [
  "qualified",
  "scheduled",
  "closed",
];

export function buildConversionFunnel(input: {
  totalLeads: number;
  qualifiedLeads: number;
  visitRequestedLeads: number;
  confirmedVisits: number;
  closedLeads: number;
}): FunnelStage[] {
  const base = input.totalLeads || 1;

  const stages: FunnelStage[] = [
    {
      stage: "leads",
      label: "Leads captured",
      value: input.totalLeads,
      percentage: 100,
    },
    {
      stage: "qualified",
      label: "Qualified",
      value: input.qualifiedLeads,
      percentage: Math.round((input.qualifiedLeads / base) * 100),
    },
    {
      stage: "visit_interest",
      label: "Visit interest",
      value: input.visitRequestedLeads,
      percentage: Math.round((input.visitRequestedLeads / base) * 100),
    },
    {
      stage: "confirmed",
      label: "Visits confirmed",
      value: input.confirmedVisits,
      percentage: Math.round((input.confirmedVisits / base) * 100),
    },
    {
      stage: "closed",
      label: "Closed won",
      value: input.closedLeads,
      percentage: Math.round((input.closedLeads / base) * 100),
    },
  ];

  return stages;
}

export function countQualifiedLeads(
  rows: { status: LeadStatus }[]
): number {
  return rows.filter((row) => QUALIFIED_STATUSES.includes(row.status)).length;
}
