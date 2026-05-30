import type { Metadata } from "next";
import { FollowUpsList } from "@/components/follow-ups/follow-ups-list";
import { getFollowUpsGrouped } from "@/lib/data/follow-ups";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";

export const metadata: Metadata = {
  title: "Follow-ups — Agentive01",
  description: "Manage automated WhatsApp follow-ups for your leads.",
};

type FollowUpsPageProps = {
  searchParams: Promise<{ group?: string }>;
};

function isGroupFilter(
  value: string | undefined
): value is "pending" | "sent" | "failed" {
  return value === "pending" || value === "sent" || value === "failed";
}

export default async function FollowUpsPage({ searchParams }: FollowUpsPageProps) {
  const params = await searchParams;
  const initialGroup = isGroupFilter(params.group) ? params.group : "pending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let buckets = null;
  let dbError: string | null = null;

  if (user) {
    try {
      const { workspaceId } = await resolveTenantScope(supabase, user.id);
      buckets = await getFollowUpsGrouped(supabase, workspaceId);
    } catch (error) {
      dbError =
        error instanceof Error ? error.message : "Could not load follow-ups.";
    }
  }

  const totalCount = buckets
    ? buckets.pending.length + buckets.sent.length + buckets.failed.length
    : 0;

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="animate-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
            Pipeline · Follow-ups
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Follow-ups
          </h1>
          <p className="mt-3 max-w-xl text-white/50">
            Contextual WhatsApp re-engagement — review pending nudges, sent
            messages, and failures in one place.
          </p>
          {buckets && (
            <p className="mt-2 text-xs text-white/35">
              {totalCount} total · {buckets.pending.length} pending ·{" "}
              {buckets.sent.length} sent · {buckets.failed.length} failed
            </p>
          )}
        </section>

        <div className="mt-10">
          <FollowUpsList
            buckets={
              buckets ?? { pending: [], sent: [], failed: [] }
            }
            dbError={dbError}
            initialGroup={initialGroup}
          />
        </div>
      </div>
    </main>
  );
}
