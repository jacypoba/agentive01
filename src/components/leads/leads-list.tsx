"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CreateTestLeadButton } from "@/components/dashboard/create-test-lead-button";
import { LanguageBadge } from "@/components/leads/language-badge";
import {
  type LeadAssigneeFilter,
} from "@/lib/leads/assignment-filters";
import { type LeadPipelineFilter } from "@/lib/leads/pipeline-filters";
import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import {
  buildLeadsScopeBeforeStatusFilter,
  filterLeadsByStatusTab,
  resolveInitialStatusFilter,
} from "@/lib/leads/leads-list-filters";
import { getAssigneeLabel } from "@/lib/leads/member-display";
import { formatLeadDate, getStatusBadgeColor } from "@/lib/leads/status";
import type { Lead, LeadStatus } from "@/types/database";

export type { LeadAssigneeFilter };

type LeadsListProps = {
  leads: Lead[];
  dbError?: string | null;
  initialStatus?: LeadStatus;
  initialAssigneeFilter?: LeadAssigneeFilter;
  initialPipeline?: LeadPipelineFilter;
  initialPeriod?: AnalyticsPeriodKey;
  currentUserId: string;
  memberLabels: Record<string, string>;
};

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "scheduled",
  "closed",
  "lost",
];

const ASSIGNEE_FILTERS: { value: LeadAssigneeFilter; label: string }[] = [
  { value: "all", label: "All leads" },
  { value: "me", label: "My leads" },
  { value: "unassigned", label: "Unassigned" },
];

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

function countByAssignee(
  leads: Lead[],
  assigneeFilter: LeadAssigneeFilter,
  currentUserId: string,
  pipeline?: LeadPipelineFilter,
  period?: AnalyticsPeriodKey
): number {
  return buildLeadsScopeBeforeStatusFilter(leads, {
    assigneeFilter,
    pipeline,
    period,
    currentUserId,
  }).length;
}

export function LeadsList({
  leads,
  dbError,
  initialStatus,
  initialAssigneeFilter = "all",
  initialPipeline,
  initialPeriod,
  currentUserId,
  memberLabels,
}: LeadsListProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">(() =>
    resolveInitialStatusFilter(initialStatus, initialPipeline)
  );
  const [assigneeFilter, setAssigneeFilter] = useState<LeadAssigneeFilter>(
    initialAssigneeFilter
  );

  const memberLabelMap = useMemo(
    () => new Map(Object.entries(memberLabels)),
    [memberLabels]
  );

  const scopedBeforeStatus = useMemo(
    () =>
      buildLeadsScopeBeforeStatusFilter(leads, {
        assigneeFilter,
        pipeline: initialPipeline,
        period: initialPeriod,
        currentUserId,
      }),
    [leads, assigneeFilter, initialPipeline, initialPeriod, currentUserId]
  );

  const filteredLeads = useMemo(() => {
    let result = filterLeadsByStatusTab(scopedBeforeStatus, statusFilter);

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return result;
    }

    return result.filter((lead) => {
      const assigneeLabel = getAssigneeLabel(
        lead.assigned_user_id,
        memberLabelMap
      );

      const haystack = [
        lead.client_name,
        lead.phone ?? "",
        lead.interest ?? "",
        lead.status,
        assigneeLabel,
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
  }, [
    scopedBeforeStatus,
    query,
    statusFilter,
    memberLabelMap,
  ]);

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
            placeholder="Search by name, phone, assignee, status…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20"
          />
        </div>
        <CreateTestLeadButton />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {ASSIGNEE_FILTERS.map(({ value, label }) => {
            const count = countByAssignee(
              leads,
              value,
              currentUserId,
              initialPipeline,
              initialPeriod
            );
            const isActive = assigneeFilter === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setAssigneeFilter(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-[#0066FF]/40 bg-[#0066FF]/20 text-[#00D4FF]"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
                }`}
              >
                {label}{" "}
                <span className="text-white/35">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", ...LEAD_STATUSES] as const).map((status) => {
            const count =
              status === "all"
                ? scopedBeforeStatus.length
                : scopedBeforeStatus.filter((lead) => lead.status === status)
                    .length;
            const isActive = statusFilter === status;

            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-[#0066FF]/40 bg-[#0066FF]/20 text-[#00D4FF]"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
                }`}
              >
                {status === "all" ? "All statuses" : status}{" "}
                <span className="text-white/35">({count})</span>
              </button>
            );
          })}
        </div>
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
          <p className="text-sm text-white/50">No leads match your filters</p>
          <p className="mt-1 text-xs text-white/30">
            Try a different search, status, or assignment filter.
          </p>
        </div>
      )}

      {filteredLeads.length > 0 && (
        <>
          <p className="text-xs text-white/40">
            Showing {filteredLeads.length} of {leads.length} lead
            {leads.length === 1 ? "" : "s"}
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Assigned to</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">
                      Phone
                    </th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-[#0066FF]/5"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block min-w-[10rem]"
                        >
                          <span className="font-medium text-white">
                            {lead.client_name}
                          </span>
                          {lead.interest && (
                            <span className="mt-0.5 block max-w-xs truncate text-xs text-white/45">
                              {lead.interest}
                            </span>
                          )}
                          <span className="mt-1 inline-flex md:hidden">
                            <LanguageBadge language={lead.preferred_language} />
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Link href={`/leads/${lead.id}`} className="inline-block">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${getStatusBadgeColor(lead.status)}`}
                          >
                            {lead.status}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top text-white/70">
                        <Link href={`/leads/${lead.id}`} className="block">
                          {getAssigneeLabel(
                            lead.assigned_user_id,
                            memberLabelMap
                          )}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 align-top text-white/60 md:table-cell">
                        <Link href={`/leads/${lead.id}`} className="block">
                          {lead.phone ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top text-white/50">
                        <Link href={`/leads/${lead.id}`} className="block whitespace-nowrap">
                          {formatLeadDate(lead.created_at)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
