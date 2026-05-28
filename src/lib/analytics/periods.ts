export type AnalyticsPeriodKey = "7" | "30" | "90" | "all";

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriodKey = "30";

export const ANALYTICS_PERIOD_OPTIONS: {
  value: AnalyticsPeriodKey;
  label: string;
}[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function parseAnalyticsPeriod(
  value: string | undefined | null
): AnalyticsPeriodKey {
  if (value === "7" || value === "30" || value === "90" || value === "all") {
    return value;
  }

  return DEFAULT_ANALYTICS_PERIOD;
}
