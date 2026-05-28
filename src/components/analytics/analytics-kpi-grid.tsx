import type { AnalyticsKpi } from "@/lib/analytics/types";

type AnalyticsKpiGridProps = {
  kpis: AnalyticsKpi[];
};

export function AnalyticsKpiGrid({ kpis }: AnalyticsKpiGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi) => (
        <article
          key={kpi.id}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-[#0066FF]/30"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            {kpi.label}
          </p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight ${kpi.accent}`}>
            {kpi.value}
          </p>
          <p className="mt-2 text-xs text-white/45">{kpi.change}</p>
        </article>
      ))}
    </div>
  );
}
