import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { getConversationsByLead } from "@/lib/data/conversations";
import { markLeadConversationRead } from "@/lib/data/inbox";
import { getLeadById } from "@/lib/data/leads";
import { listWorkspaceMembers } from "@/lib/data/workspace-members";
import {
  buildMemberLabelMap,
} from "@/lib/leads/member-display";
import { canReassignLeads } from "@/lib/team/roles";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspaces/get-current-workspace";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";

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

  const { workspaceId } = await resolveTenantScope(supabase, user.id);
  const lead = await getLeadById(supabase, workspaceId, id);

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

  const { workspaceId } = await resolveTenantScope(supabase, user.id);
  const [lead, conversations, workspace, members] = await Promise.all([
    getLeadById(supabase, workspaceId, id),
    getConversationsByLead(supabase, workspaceId, id),
    getCurrentWorkspace(supabase, user.id),
    listWorkspaceMembers(supabase, workspaceId),
  ]);

  if (!lead) {
    notFound();
  }

  try {
    await markLeadConversationRead(supabase, workspaceId, id, user.id);
    revalidatePath("/leads");
  } catch (error) {
    console.error("[LeadDetailPage] markLeadConversationRead failed", {
      leadId: id,
      userId: user.id,
      error,
    });
  }

  const memberLabels = Object.fromEntries(
    buildMemberLabelMap(members).entries()
  );

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl animate-fade-up">
        <LeadDetailView
          lead={lead}
          conversations={conversations}
          members={members}
          memberLabels={memberLabels}
          canReassign={workspace ? canReassignLeads(workspace.role) : false}
        />
      </div>
    </main>
  );
}
