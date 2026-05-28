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
  CHART_COLORS,
  CHART_GRID,
  CHART_PALETTE,
  CHART_TOOLTIP_STYLE,
  ChartCard,
} from "@/components/analytics/chart-card";
import type { FunnelStage } from "@/lib/analytics/types";

type ConversionFunnelChartProps = {
  data: FunnelStage[];
};

export function ConversionFunnelChart({ data }: ConversionFunnelChartProps) {
  const total = data[0]?.value ?? 0;

  return (
    <ChartCard
      title="Conversion funnel"
      description="Pipeline progression from capture to close."
      empty={total === 0}
      emptyMessage="Add leads to see your conversion funnel."
    >
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid {...CHART_GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={108}
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS.tick}
            />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value, _name, item) => {
                const payload = item.payload as FunnelStage;
                return [`${value ?? 0} (${payload.percentage}%)`, "Leads"];
              }}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.stage}
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
