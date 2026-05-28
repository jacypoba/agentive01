import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import type { AnalyticsDateRange } from "@/lib/analytics/types";

export function buildAnalyticsDateRangeForPeriod(
  period: AnalyticsPeriodKey
): AnalyticsDateRange {
  if (period === "all") {
    return {
      label: "All time",
      period,
      days: null,
      start: null,
      end: null,
      allTime: true,
    };
  }

  const days = Number(period);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return {
    label: `Last ${days} days`,
    period,
    days,
    start: start.toISOString(),
    end: end.toISOString(),
    allTime: false,
  };
}

/** @deprecated Use buildAnalyticsDateRangeForPeriod instead. */
export function buildAnalyticsDateRange(days = 30): AnalyticsDateRange {
  const period =
    days === 7 ? "7" : days === 90 ? "90" : days === 30 ? "30" : "30";
  return buildAnalyticsDateRangeForPeriod(period);
}

export function formatChartDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatChartMonthLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function toDayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function buildDayKeys(range: AnalyticsDateRange): string[] {
  if (range.allTime || !range.start || !range.end) {
    return [];
  }

  const keys: string[] = [];
  const cursor = new Date(range.start);
  const end = new Date(range.end);

  while (cursor <= end) {
    keys.push(toDayKey(cursor.toISOString()));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function buildDayKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);

  while (cursor <= end) {
    keys.push(toDayKey(cursor.toISOString()));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function startOfWeekKey(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toDayKey(date.toISOString());
}

export function startOfMonthKey(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00`);
  date.setDate(1);
  return toDayKey(date.toISOString());
}
