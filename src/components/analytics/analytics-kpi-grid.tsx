import Link from "next/link";
import type { AnalyticsKpi } from "@/lib/analytics/types";

type AnalyticsKpiGridProps = {
  kpis: AnalyticsKpi[];
};

export function AnalyticsKpiGrid({ kpis }: AnalyticsKpiGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi) => (
        <Link
          key={kpi.id}
          href={kpi.href}
          className="group block cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 hover:shadow-lg hover:shadow-[#0066FF]/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/50"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 transition-colors group-hover:text-white/55">
            {kpi.label}
          </p>
          <p
            className={`mt-2 text-3xl font-semibold tracking-tight ${kpi.accent}`}
          >
            {kpi.value}
          </p>
          <p className="mt-2 text-xs text-white/45 transition-colors group-hover:text-white/55">
            {kpi.change}
          </p>
        </Link>
      ))}
    </div>
  );
}
