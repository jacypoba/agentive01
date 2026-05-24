import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { getConversationsByLead } from "@/lib/data/conversations";
import { getLeadById } from "@/lib/data/leads";
import { createClient } from "@/lib/supabase/server";

type LeadPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: LeadPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: "Lead — Agentive01" };
  }

  const lead = await getLeadById(supabase, user.id, id);

  return {
    title: lead
      ? `${lead.client_name} — Agentive01`
      : "Lead — Agentive01",
    description: lead?.interest ?? "Lead details and conversation.",
  };
}

export default async function LeadDetailPage({ params }: LeadPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const lead = await getLeadById(supabase, user.id, id);
  if (!lead) {
    notFound();
  }

  const conversations = await getConversationsByLead(supabase, id);

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl animate-fade-up">
        <LeadDetailView lead={lead} conversations={conversations} />
      </div>
    </main>
  );
}
