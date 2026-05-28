import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description?: string;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
};

export function ChartCard({
  title,
  description,
  empty = false,
  emptyMessage = "No data for this period yet.",
  children,
}: ChartCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            {description}
          </p>
        )}
      </div>

      {empty ? (
        <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-4 text-center">
          <p className="text-sm text-white/40">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </article>
  );
}

export const CHART_COLORS = {
  primary: "#0066FF",
  accent: "#00D4FF",
  amber: "#FBBF24",
  emerald: "#34D399",
  violet: "#A78BFA",
  slate: "#64748B",
};

export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.accent,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.violet,
  CHART_COLORS.slate,
];

export const CHART_AXIS = {
  stroke: "rgba(255,255,255,0.25)",
  tick: { fill: "rgba(255,255,255,0.45)", fontSize: 11 },
};

export const CHART_GRID = {
  stroke: "rgba(255,255,255,0.06)",
  strokeDasharray: "4 4",
};

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0a0a0a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "12px",
  },
  itemStyle: { color: "#00D4FF" },
  labelStyle: { color: "rgba(255,255,255,0.6)" },
};
