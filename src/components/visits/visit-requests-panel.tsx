import Link from "next/link";
import { formatRelativeTime } from "@/lib/data/dashboard";
import {
  getVisitStatusColor,
  getVisitStatusLabel,
} from "@/lib/visits/status";
import type { VisitRequestWithLead } from "@/types/database";

type VisitRequestsPanelProps = {
  visits: VisitRequestWithLead[];
};

export function VisitRequestsPanel({ visits }: VisitRequestsPanelProps) {
  const pendingCount = visits.filter((v) => v.status === "pending").length;

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Visit requests</h2>
          <p className="mt-1 text-xs text-white/40">
            {pendingCount > 0
              ? `${pendingCount} pending confirmation`
              : "No pending visits right now"}
          </p>
        </div>
        <Link
          href="/visits"
          className="w-fit rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 transition-all hover:border-[#0066FF]/40 hover:text-white"
        >
          View all visits
        </Link>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        {visits.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-white/50">No visit requests yet</p>
            <p className="mt-1 text-xs text-white/30">
              When a lead asks to schedule via WhatsApp, it will appear here as
              pending.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/leads/${visit.lead_id}`}
                      className="text-sm font-medium text-white hover:text-[#00D4FF]"
                    >
                      {visit.leads.client_name}
                    </Link>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${getVisitStatusColor(visit.status)}`}
                    >
                      {getVisitStatusLabel(visit.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/40">
                    {visit.requested_datetime_text
                      ? `Requested: ${visit.requested_datetime_text}`
                      : "Date/time not specified yet"}
                    {visit.leads.preferred_area
                      ? ` · ${visit.leads.preferred_area}`
                      : ""}
                  </p>
                  <p className="mt-1 text-[10px] text-white/30">
                    {formatRelativeTime(visit.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
