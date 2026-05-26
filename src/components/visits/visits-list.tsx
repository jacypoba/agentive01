"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateVisitStatus } from "@/app/actions/visits";
import { formatRelativeTime } from "@/lib/data/dashboard";
import { formatLeadDate } from "@/lib/leads/status";
import {
  getVisitStatusColor,
  getVisitStatusLabel,
} from "@/lib/visits/status";
import type { VisitRequestStatus, VisitRequestWithLead } from "@/types/database";

type VisitsListProps = {
  visits: VisitRequestWithLead[];
  dbError?: string | null;
};

type StatusFilter = "all" | VisitRequestStatus;

export function VisitsList({ visits, dbError }: VisitsListProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredVisits = useMemo(() => {
    if (filter === "all") return visits;
    return visits.filter((visit) => visit.status === filter);
  }, [filter, visits]);

  const counts = useMemo(
    () => ({
      all: visits.length,
      pending: visits.filter((v) => v.status === "pending").length,
      confirmed: visits.filter((v) => v.status === "confirmed").length,
      cancelled: visits.filter((v) => v.status === "cancelled").length,
    }),
    [visits]
  );

  function handleStatusChange(visitId: string, status: VisitRequestStatus) {
    setError(null);
    setPendingId(visitId);
    startTransition(async () => {
      const result = await updateVisitStatus(visitId, status);
      if (result.error) {
        setError(result.error);
      }
      setPendingId(null);
    });
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "confirmed", label: `Confirmed (${counts.confirmed})` },
    { key: "cancelled", label: `Cancelled (${counts.cancelled})` },
  ];

  return (
    <div>
      {dbError && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200"
        >
          <p className="font-medium">Database not ready</p>
          <p className="mt-1 text-amber-200/80">
            Run migration{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              supabase/migrations/005_visit_requests.sql
            </code>{" "}
            in the Supabase SQL Editor, then refresh.
          </p>
          <p className="mt-2 text-xs text-amber-200/60">{dbError}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              filter === item.key
                ? "border-[#0066FF]/40 bg-[#0066FF]/20 text-[#00D4FF]"
                : "border-white/10 text-white/50 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {filteredVisits.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-12 text-center">
            <p className="text-sm text-white/50">No visit requests found</p>
            <p className="mt-1 text-xs text-white/30">
              Requests detected from WhatsApp will appear here as pending.
            </p>
          </div>
        ) : (
          filteredVisits.map((visit) => (
            <article
              key={visit.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-[#0066FF]/30"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/leads/${visit.lead_id}`}
                      className="text-base font-semibold text-white hover:text-[#00D4FF]"
                    >
                      {visit.leads.client_name}
                    </Link>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getVisitStatusColor(visit.status)}`}
                    >
                      {getVisitStatusLabel(visit.status)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-white/50">
                    <p>
                      <span className="text-white/30">When: </span>
                      {visit.requested_datetime_text ?? "Not specified"}
                    </p>
                    {visit.leads.phone && (
                      <p>
                        <span className="text-white/30">Phone: </span>
                        {visit.leads.phone}
                      </p>
                    )}
                    {(visit.leads.preferred_area || visit.leads.property_type) && (
                      <p>
                        <span className="text-white/30">Interest: </span>
                        {[visit.leads.property_type, visit.leads.preferred_area]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {visit.notes && (
                      <p>
                        <span className="text-white/30">Notes: </span>
                        {visit.notes}
                      </p>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-white/30">
                    Requested {formatRelativeTime(visit.created_at)} ·{" "}
                    {formatLeadDate(visit.created_at)}
                  </p>
                </div>

                {visit.status === "pending" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending && pendingId === visit.id}
                      onClick={() => handleStatusChange(visit.id, "confirmed")}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Confirm visit
                    </button>
                    <button
                      type="button"
                      disabled={isPending && pendingId === visit.id}
                      onClick={() => handleStatusChange(visit.id, "cancelled")}
                      className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 transition-all hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
