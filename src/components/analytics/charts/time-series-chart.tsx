"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  ChartCard,
} from "@/components/analytics/chart-card";
import type { TimeSeriesPoint } from "@/lib/analytics/types";

type TimeSeriesChartProps = {
  title: string;
  description?: string;
  data: TimeSeriesPoint[];
  color?: string;
  valueLabel?: string;
};

export function TimeSeriesChart({
  title,
  description,
  data,
  color = CHART_COLORS.primary,
  valueLabel = "Count",
}: TimeSeriesChartProps) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const tickInterval = data.length > 14 ? Math.ceil(data.length / 7) : 0;

  return (
    <ChartCard
      title={title}
      description={description}
      empty={total === 0}
      emptyMessage="No activity recorded in this period."
    >
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_GRID} vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
              tick={CHART_AXIS.tick}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS.tick}
              width={32}
            />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value) => [value ?? 0, valueLabel]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.accent }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
