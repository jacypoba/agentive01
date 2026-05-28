"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CreateTestLeadButton } from "@/components/dashboard/create-test-lead-button";
import { LanguageBadge } from "@/components/leads/language-badge";
import { LeadQualificationSummary } from "@/components/leads/lead-qualification-summary";
import { formatLeadDate, getStatusBadgeColor } from "@/lib/leads/status";
import { getIntentStatusColor, getIntentStatusLabel } from "@/lib/leads/qualification-display";
import type { Lead, LeadStatus } from "@/types/database";

type LeadsListProps = {
  leads: Lead[];
  dbError?: string | null;
  initialStatus?: LeadStatus;
};

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "scheduled",
  "closed",
  "lost",
];

function isLeadStatus(value: string | undefined): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus);
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-white/30"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-white/30"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-white/30"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
    </svg>
  );
}

export function LeadsList({ leads, dbError, initialStatus }: LeadsListProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">(
    initialStatus ?? "all"
  );

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (statusFilter !== "all") {
      result = result.filter((lead) => lead.status === statusFilter);
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) return result;

    return result.filter((lead) => {
      const haystack = [
        lead.client_name,
        lead.phone ?? "",
        lead.interest ?? "",
        lead.status,
        lead.budget ?? "",
        lead.preferred_area ?? "",
        lead.property_type ?? "",
        lead.timeline ?? "",
        lead.intent_status ?? "",
        lead.visit_datetime_text ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [leads, query, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, phone, budget, area, status…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20"
          />
        </div>
        <CreateTestLeadButton />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...LEAD_STATUSES] as const).map((status) => {
          const count =
            status === "all"
              ? leads.length
              : leads.filter((lead) => lead.status === status).length;
          const isActive = statusFilter === status;

          return (
            <Link
              key={status}
              href={status === "all" ? "/leads" : `/leads?status=${status}`}
              onClick={(event) => {
                event.preventDefault();
                setStatusFilter(status);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "border-[#0066FF]/40 bg-[#0066FF]/20 text-[#00D4FF]"
                  : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
              }`}
            >
              {status === "all" ? "All" : status}{" "}
              <span className="text-white/35">({count})</span>
            </Link>
          );
        })}
      </div>

      {dbError && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200"
        >
          <p className="font-medium">Database not ready</p>
          <p className="mt-1 text-amber-200/80">
            Run the migration in{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              supabase/migrations/001_initial_schema.sql
            </code>{" "}
            via the Supabase SQL Editor, then refresh.
          </p>
          <p className="mt-2 text-xs text-amber-200/60">{dbError}</p>
        </div>
      )}

      {!dbError && leads.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/80 px-6 py-16 text-center backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0066FF10_0%,_transparent_70%)]" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#0066FF]/30 bg-[#0066FF]/10">
              <svg
                className="h-7 w-7 text-[#00D4FF]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">No leads yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-white/50">
              Your pipeline is empty. Create a test lead to preview how captured
              WhatsApp inquiries will appear here.
            </p>
          </div>
        </div>
      )}

      {!dbError && leads.length > 0 && filteredLeads.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-sm text-white/50">No leads match your search</p>
          <p className="mt-1 text-xs text-white/30">
            Try a different name, phone number, or status.
          </p>
        </div>
      )}

      {filteredLeads.length > 0 && (
        <>
          <p className="text-xs text-white/40">
            Showing {filteredLeads.length} of {leads.length} lead
            {leads.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-300 hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 hover:shadow-lg hover:shadow-[#0066FF]/5"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#0066FF]/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-white">
                      {lead.client_name}
                    </h3>
                    {lead.interest && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/50">
                        {lead.interest}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider capitalize ${getStatusBadgeColor(lead.status)}`}
                  >
                    {lead.status}
                  </span>
                </div>

                <div className="relative mt-5 space-y-3 border-t border-white/5 pt-4">
                  <LanguageBadge language={lead.preferred_language} />

                  {lead.intent_status && lead.intent_status !== "unknown" && (
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${getIntentStatusColor(lead.intent_status)}`}
                    >
                      {getIntentStatusLabel(lead.intent_status)}
                    </span>
                  )}

                  <LeadQualificationSummary lead={lead} compact />

                  {lead.phone && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <PhoneIcon />
                      <span className="truncate">{lead.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <CalendarIcon />
                    <span>{formatLeadDate(lead.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {!dbError && (
        <div className="pt-4">
          <Link
            href="/dashboard"
            className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-all hover:border-white/25 hover:bg-white/10"
          >
            ← Back to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
