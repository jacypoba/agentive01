"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_PALETTE,
  CHART_TOOLTIP_STYLE,
  ChartCard,
} from "@/components/analytics/chart-card";
import type { DistributionPoint } from "@/lib/analytics/types";

type HorizontalBarChartProps = {
  title: string;
  description?: string;
  data: DistributionPoint[];
  emptyMessage?: string;
};

export function HorizontalBarChart({
  title,
  description,
  data,
  emptyMessage = "No data available yet.",
}: HorizontalBarChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard title={title} description={description} empty={total === 0} emptyMessage={emptyMessage}>
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
          >
            <CartesianGrid {...CHART_GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS.tick}
            />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value) => [value ?? 0, "Count"]}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
