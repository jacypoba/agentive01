import type { AnalyticsDateRange } from "@/lib/analytics/types";
import type { FollowUpAnalyticsRow } from "@/lib/analytics/queries";

export function isFollowUpSentInRange(
  row: FollowUpAnalyticsRow,
  range: AnalyticsDateRange
): boolean {
  if (row.status !== "sent" || !row.sent_at) {
    return false;
  }

  if (range.allTime || !range.start || !range.end) {
    return true;
  }

  return row.sent_at >= range.start && row.sent_at <= range.end;
}

export function countSentFollowUpsInPeriod(
  rows: FollowUpAnalyticsRow[],
  range: AnalyticsDateRange
): number {
  return rows.filter((row) => isFollowUpSentInRange(row, range)).length;
}
