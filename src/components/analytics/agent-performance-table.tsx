import { ChartCard } from "@/components/analytics/chart-card";
import type { AgentPerformanceRow } from "@/lib/analytics/assignment-metrics";

type AgentPerformanceTableProps = {
  rows: AgentPerformanceRow[];
  periodLabel: string;
};

function formatMetric(value: number): string {
  return value.toLocaleString("en-US");
}

export function AgentPerformanceTable({
  rows,
  periodLabel,
}: AgentPerformanceTableProps) {
  return (
    <ChartCard
      title="Agent performance"
      description={`Leads, qualification, visits, and follow-ups by current assignee — ${periodLabel.toLowerCase()}.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] font-medium uppercase tracking-wider text-white/40">
              <th className="pb-3 pr-4 font-medium">Agent</th>
              <th className="pb-3 pr-4 text-right font-medium">Leads</th>
              <th className="pb-3 pr-4 text-right font-medium">Qualified</th>
              <th className="pb-3 pr-4 text-right font-medium">
                Conversion rate
              </th>
              <th className="pb-3 pr-4 text-right font-medium">Visits</th>
              <th className="pb-3 text-right font-medium">Follow-ups sent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.isUnassigned ? "unassigned" : row.assigneeId!}
                className="border-b border-white/5 last:border-0"
              >
                <td className="py-3 pr-4 font-medium text-white">
                  <span
                    className={
                      row.isUnassigned ? "text-white/55 italic" : undefined
                    }
                  >
                    {row.agentLabel}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/85">
                  {formatMetric(row.leads)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-white/85">
                  {formatMetric(row.qualified)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-[#00D4FF]">
                  {row.conversionRate}%
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-amber-300/90">
                  {formatMetric(row.visits)}
                </td>
                <td className="py-3 text-right tabular-nums text-white/85">
                  {formatMetric(row.followUpsSent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-white/35">
        Attribution uses the lead&apos;s current assignee (
        <code className="text-white/45">assigned_user_id</code>
        ). Visits and follow-ups are joined through the lead — not{" "}
        <code className="text-white/45">visit_requests.user_id</code> or{" "}
        <code className="text-white/45">follow_ups.user_id</code>. Reassignment
        moves historical visit and follow-up credit to the new assignee.
      </p>
    </ChartCard>
  );
}
