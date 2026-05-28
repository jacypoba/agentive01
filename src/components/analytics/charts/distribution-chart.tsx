"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  CHART_PALETTE,
  CHART_TOOLTIP_STYLE,
  ChartCard,
} from "@/components/analytics/chart-card";
import type { DistributionPoint } from "@/lib/analytics/types";

type DistributionChartProps = {
  title: string;
  description?: string;
  data: DistributionPoint[];
  emptyMessage?: string;
};

export function DistributionChart({
  title,
  description,
  data,
  emptyMessage = "No data available yet.",
}: DistributionChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard title={title} description={description} empty={total === 0} emptyMessage={emptyMessage}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div className="h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={84}
                paddingAngle={2}
                stroke="rgba(255,255,255,0.08)"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                {...CHART_TOOLTIP_STYLE}
                formatter={(value, _name, item) => {
                  const payload = item.payload as DistributionPoint;
                  return [`${value ?? 0} (${payload.percentage}%)`, payload.name];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="space-y-2">
          {data.map((item, index) => (
            <li
              key={item.name}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2 text-white/70">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length],
                  }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 font-medium text-white/80">
                {item.percentage}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
