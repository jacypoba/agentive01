"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ANALYTICS_PERIOD_OPTIONS,
  type AnalyticsPeriodKey,
} from "@/lib/analytics/periods";

type AnalyticsPeriodSelectorProps = {
  activePeriod: AnalyticsPeriodKey;
};

export function AnalyticsPeriodSelector({
  activePeriod,
}: AnalyticsPeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(period: AnalyticsPeriodKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Analytics time period"
      className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/30 p-1"
    >
      {ANALYTICS_PERIOD_OPTIONS.map((option) => {
        const isActive = option.value === activePeriod;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            aria-pressed={isActive}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? "bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/20"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
