import Link from "next/link";
import { formatRelativeTime } from "@/lib/data/dashboard";
import { getVisitStatusColor, getVisitStatusLabel } from "@/lib/visits/status";
import type { CalendarVisitBuckets } from "@/types/database";

type CalendarVisitsPanelProps = {
  buckets: CalendarVisitBuckets;
};

function VisitRow({
  clientName,
  when,
  status,
  leadId,
  propertyTitle,
}: {
  clientName: string;
  when: string;
  status: string;
  leadId: string;
  propertyTitle?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <Link
          href={`/leads/${leadId}`}
          className="text-sm font-medium text-white hover:text-[#00D4FF]"
        >
          {clientName}
        </Link>
        <p className="mt-1 text-xs text-white/45">{when}</p>
        {propertyTitle && (
          <p className="mt-0.5 text-xs text-white/30">{propertyTitle}</p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${getVisitStatusColor(status as "pending" | "confirmed" | "cancelled")}`}
      >
        {getVisitStatusLabel(status as "pending" | "confirmed" | "cancelled")}
      </span>
    </div>
  );
}

function formatWhen(visit: CalendarVisitBuckets["today"][number]): string {
  if (visit.scheduled_start) {
    return new Date(visit.scheduled_start).toLocaleString("pt-PT", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return visit.requested_datetime_text ?? "Time not set";
}

export function CalendarVisitsPanel({ buckets }: CalendarVisitsPanelProps) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Visit calendar</h2>
          <p className="mt-1 text-sm text-white/45">
            Today, upcoming confirmed visits, and pending requests.
          </p>
        </div>
        <Link
          href="/settings/calendar"
          className="text-xs font-medium text-[#00D4FF] hover:text-white"
        >
          Calendar settings →
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Today</h3>
          <div className="mt-2 divide-y divide-white/5">
            {buckets.today.length === 0 ? (
              <p className="py-4 text-xs text-white/35">No visits today.</p>
            ) : (
              buckets.today.map((visit) => (
                <VisitRow
                  key={visit.id}
                  clientName={visit.leads.client_name}
                  when={formatWhen(visit)}
                  status={visit.status}
                  leadId={visit.lead_id}
                  propertyTitle={visit.property_title}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Upcoming</h3>
          <div className="mt-2 divide-y divide-white/5">
            {buckets.upcoming.length === 0 ? (
              <p className="py-4 text-xs text-white/35">No upcoming visits.</p>
            ) : (
              buckets.upcoming.map((visit) => (
                <VisitRow
                  key={visit.id}
                  clientName={visit.leads.client_name}
                  when={formatWhen(visit)}
                  status={visit.status}
                  leadId={visit.lead_id}
                  propertyTitle={visit.property_title}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Pending</h3>
          <div className="mt-2 divide-y divide-white/5">
            {buckets.pending.length === 0 ? (
              <p className="py-4 text-xs text-white/35">No pending requests.</p>
            ) : (
              buckets.pending.map((visit) => (
                <VisitRow
                  key={visit.id}
                  clientName={visit.leads.client_name}
                  when={
                    visit.requested_datetime_text ??
                    formatRelativeTime(visit.created_at)
                  }
                  status={visit.status}
                  leadId={visit.lead_id}
                  propertyTitle={visit.property_title}
                />
              ))
            )}
          </div>
          <Link
            href="/visits"
            className="mt-4 inline-block text-xs text-[#0066FF] hover:text-[#00D4FF]"
          >
            Manage all visits →
          </Link>
        </div>
      </div>
    </section>
  );
}
