import type { AnalyticsDateRange } from "@/lib/analytics/types";

export function buildAnalyticsDateRange(days = 30): AnalyticsDateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return {
    label: `Last ${days} days`,
    days,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function formatChartDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function toDayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function buildDayKeys(range: AnalyticsDateRange): string[] {
  const keys: string[] = [];
  const cursor = new Date(range.start);
  const end = new Date(range.end);

  while (cursor <= end) {
    keys.push(toDayKey(cursor.toISOString()));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}
