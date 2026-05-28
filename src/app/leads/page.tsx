import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadsList } from "@/components/leads/leads-list";
import { LeadsListSkeleton } from "@/components/leads/leads-list-skeleton";
import { getLeads } from "@/lib/data/leads";
import { createClient } from "@/lib/supabase/server";
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

export const metadata: Metadata = {
  title: "Leads — Agentive01",
  description: "Manage your real estate leads pipeline.",
};

type LeadsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

async function LeadsContent({
  initialStatus,
}: {
  initialStatus?: LeadStatus;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let leads = null;
  let dbError: string | null = null;

  if (user) {
    try {
      leads = await getLeads(supabase, user.id);
    } catch (error) {
      dbError =
        error instanceof Error ? error.message : "Could not load leads.";
    }
  }

  return (
    <LeadsList
      leads={leads ?? []}
      dbError={dbError}
      initialStatus={initialStatus}
    />
  );
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const initialStatus = isLeadStatusParam(params.status)
    ? params.status
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
            <LeadsContent initialStatus={initialStatus} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
