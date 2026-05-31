import type { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";
import { TeamSettingsPanel } from "@/components/settings/team-settings-panel";
import { getPlanLimits } from "@/lib/billing/plan-limits";
import { getWorkspaceSubscription } from "@/lib/billing/workspace-subscription";
import { listWorkspaceInvitations } from "@/lib/data/workspace-invitations";
import {
  countTeamSeatsUsed,
} from "@/lib/team/team-limits";
import { canManageTeam } from "@/lib/team/roles";
import {
  listWorkspaceMembers,
} from "@/lib/data/workspace-members";
import { getCurrentWorkspace } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Team — Agentive01",
};

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let loadError: string | null = null;
  let workspaceName = "Workspace";
  let actorRole: WorkspaceRole = "member";
  let canManage = false;
  let members: Awaited<ReturnType<typeof listWorkspaceMembers>> = [];
  let invitations: Awaited<ReturnType<typeof listWorkspaceInvitations>> = [];
  let seatLimit = 1;
  let seatsUsed = 0;

  if (user) {
    try {
      const workspace = await getCurrentWorkspace(supabase, user.id);
      if (!workspace) {
        loadError = "No active workspace found.";
      } else {
        workspaceName = workspace.name;
        actorRole = workspace.role;
        canManage = canManageTeam(workspace.role);

        const subscription = await getWorkspaceSubscription(
          supabase,
          workspace.id,
          user.id
        );
        seatLimit = getPlanLimits(subscription?.plan_name ?? "starter").maxTeamMembers;
        seatsUsed = await countTeamSeatsUsed(supabase, workspace.id);

        members = await listWorkspaceMembers(supabase, workspace.id);

        if (canManage) {
          invitations = await listWorkspaceInvitations(supabase, workspace.id);
        }
      }
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Could not load team settings.";
    }
  }

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="animate-fade-up">
          <p className="text-xs font-medium uppercase tracking-wider text-[#00D4FF]">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Team</h1>
          <p className="mt-2 text-sm text-white/50">
            Manage who has access to {workspaceName}. Invitations are
            workspace-scoped and respect your plan&apos;s team member limit.
          </p>
          <SettingsNav />
        </section>

        {loadError && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
            {loadError}
          </div>
        )}

        {!loadError && user && (
          <TeamSettingsPanel
            members={members}
            invitations={invitations}
            actorRole={actorRole}
            seatLimit={seatLimit}
            seatsUsed={seatsUsed}
            canManage={canManage}
          />
        )}
      </div>
    </main>
  );
}
