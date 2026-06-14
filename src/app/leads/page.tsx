import type { Metadata } from "next";
import { Suspense } from "react";
import {
  LeadsList,
} from "@/components/leads/leads-list";
import { LeadsListSkeleton } from "@/components/leads/leads-list-skeleton";
import { getLeads } from "@/lib/data/leads";
import { listWorkspaceMembers } from "@/lib/data/workspace-members";
import type { LeadAssigneeFilter } from "@/lib/leads/assignment-filters";
import { buildMemberLabelMap } from "@/lib/leads/member-display";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";
import type { LeadStatus } from "@/types/database";

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "scheduled",
  "closed",
  "lost",
];

function isLeadStatusParam(value: string | undefined): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus);
}

function isAssigneeFilterParam(
  value: string | undefined
): value is LeadAssigneeFilter {
  return value === "me" || value === "unassigned" || value === "all";
}

export const metadata: Metadata = {
  title: "Leads — Agentive01",
  description: "Manage your real estate leads pipeline.",
};

type LeadsPageProps = {
  searchParams: Promise<{ status?: string; assignee?: string }>;
};

async function LeadsContent({
  initialStatus,
  initialAssigneeFilter,
}: {
  initialStatus?: LeadStatus;
  initialAssigneeFilter?: LeadAssigneeFilter;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let leads = null;
  let memberLabels: Record<string, string> = {};
  let dbError: string | null = null;

  if (user) {
    try {
      const { workspaceId } = await resolveTenantScope(supabase, user.id);
      const [loadedLeads, members] = await Promise.all([
        getLeads(supabase, workspaceId),
        listWorkspaceMembers(supabase, workspaceId),
      ]);
      leads = loadedLeads;
      memberLabels = Object.fromEntries(
        buildMemberLabelMap(members).entries()
      );
    } catch (error) {
      dbError =
        error instanceof Error ? error.message : "Could not load leads.";
    }
  }

  if (!user) {
    return null;
  }

  return (
    <LeadsList
      leads={leads ?? []}
      dbError={dbError}
      initialStatus={initialStatus}
      initialAssigneeFilter={initialAssigneeFilter}
      currentUserId={user.id}
      memberLabels={memberLabels}
    />
  );
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const initialStatus = isLeadStatusParam(params.status)
    ? params.status
    : undefined;
  const initialAssigneeFilter = isAssigneeFilterParam(params.assignee)
    ? params.assignee
    : undefined;

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="animate-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D4FF] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D4FF]" />
            </span>
            Pipeline · Leads
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your{" "}
            <span className="bg-gradient-to-r from-[#00D4FF] via-[#0066FF] to-[#00D4FF] bg-clip-text text-transparent">
              leads
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-white/50">
            Every WhatsApp inquiry captured, qualified, and tracked in one place.
          </p>
        </section>

        <section className="mt-10">
          <Suspense fallback={<LeadsListSkeleton />}>
            <LeadsContent
              initialStatus={initialStatus}
              initialAssigneeFilter={initialAssigneeFilter}
            />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
