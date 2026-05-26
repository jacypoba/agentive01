import type { Metadata } from "next";
import { VisitsList } from "@/components/visits/visits-list";
import { getVisitRequests } from "@/lib/data/visit-requests";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Visit Requests — Agentive01",
  description: "Manage property visit requests from WhatsApp leads.",
};

export default async function VisitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let visits = null;
  let dbError: string | null = null;

  if (user) {
    try {
      visits = await getVisitRequests(supabase, user.id);
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
          <VisitsList visits={visits ?? []} dbError={dbError} />
        </div>
      </div>
    </main>
  );
}
