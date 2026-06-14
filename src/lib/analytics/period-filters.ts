import { buildAnalyticsDateRangeForPeriod } from "@/lib/analytics/date-ranges";
import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";

export function isTimestampInAnalyticsPeriod(
  isoTimestamp: string,
  period: AnalyticsPeriodKey
): boolean {
  const range = buildAnalyticsDateRangeForPeriod(period);

  if (range.allTime || !range.start || !range.end) {
    return true;
  }

  return isoTimestamp >= range.start && isoTimestamp <= range.end;
}

export function startOfTodayIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export function isSentAtToday(sentAt: string | null | undefined): boolean {
  if (!sentAt) {
    return false;
  }

  return sentAt >= startOfTodayIso();
}

export function isSentAtInAnalyticsPeriod(
  sentAt: string | null | undefined,
  period: AnalyticsPeriodKey
): boolean {
  if (!sentAt) {
    return false;
  }

  return isTimestampInAnalyticsPeriod(sentAt, period);
}
