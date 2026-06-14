import {
  isSentAtInAnalyticsPeriod,
  isSentAtToday,
} from "@/lib/analytics/period-filters";
import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import type { FollowUpWithLead } from "@/types/database";

type FollowUpDrillDownFilters = {
  today?: boolean;
  period?: AnalyticsPeriodKey;
};

export function filterFollowUpsForDrillDown(
  items: FollowUpWithLead[],
  filters: FollowUpDrillDownFilters
): FollowUpWithLead[] {
  let result = items;

  if (filters.today) {
    result = result.filter((item) => isSentAtToday(item.sent_at));
  }

  if (filters.period) {
    result = result.filter((item) =>
      isSentAtInAnalyticsPeriod(item.sent_at, filters.period!)
    );
  }

  return result;
}
