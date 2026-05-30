import type { Metadata } from "next";
import { VisitsList } from "@/components/visits/visits-list";
import { getVisitRequests } from "@/lib/data/visit-requests";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";
import type { VisitRequestStatus } from "@/types/database";

function isVisitStatusFilter(
  value: string | undefined
): value is "all" | VisitRequestStatus {
  return (
    value === "all" ||
    value === "pending" ||
    value === "confirmed" ||
    value === "cancelled"
  );
}

export const metadata: Metadata = {
  title: "Visit Requests — Agentive01",
  description: "Manage property visit requests from WhatsApp leads.",
};

type VisitsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const params = await searchParams;
  const initialStatus = isVisitStatusFilter(params.status)
    ? params.status
    : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let visits = null;
  let dbError: string | null = null;

  if (user) {
    try {
      const { workspaceId } = await resolveTenantScope(supabase, user.id);
      visits = await getVisitRequests(supabase, workspaceId);
    } catch (error) {
      dbError =
        error instanceof Error
          ? error.message
          : "Could not load visit requests.";
    }
  }

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="animate-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
            Pipeline · Visits
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Visit requests
          </h1>
          <p className="mt-3 max-w-xl text-white/50">
            Leads who ask to schedule a visit via WhatsApp appear here as
            pending. Confirm or cancel only after your team validates the slot.
          </p>
        </section>

        <div className="mt-10">
          <VisitsList
            visits={visits ?? []}
            dbError={dbError}
            initialStatus={initialStatus}
          />
        </div>
      </div>
    </main>
  );
}
