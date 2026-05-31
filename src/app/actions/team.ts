"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acceptWorkspaceInvitation,
  cancelWorkspaceInvitation,
  createWorkspaceInvitation,
  findInvitationByToken,
  getPendingInvitationForEmail,
  isInvitationExpired,
  markInvitationExpired,
  resendWorkspaceInvitation,
} from "@/lib/data/workspace-invitations";
import {
  addWorkspaceMember,
  countWorkspaceOwners,
  getWorkspaceMemberById,
  getWorkspaceMemberByUserId,
  isEmailAlreadyWorkspaceMember,
  removeWorkspaceMember,
} from "@/lib/data/workspace-members";
import { assertCanAddTeamSeat } from "@/lib/team/team-limits";
import {
  assertCanInviteRole,
  assertCanManageTeam,
  assertCanRemoveMember,
  TeamAccessError,
} from "@/lib/team/roles";
import { sendTeamInvitationEmail } from "@/lib/team/invitation-email";
import {
  normalizeInvitationEmail,
  parseInvitableRole,
  validateInvitationEmail,
  emailsMatch,
} from "@/lib/team/validation";
import { getCurrentWorkspace } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import type { InvitableRole } from "@/lib/team/roles";

export type TeamActionState = {
  error?: string;
  success?: string;
  inviteUrl?: string;
};

function revalidateTeamPaths() {
  revalidatePath("/settings/team");
}

async function requireTeamManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new TeamAccessError("You must be signed in.");
  }

  const workspace = await getCurrentWorkspace(supabase, user.id);
  if (!workspace) {
    throw new TeamAccessError("No active workspace found.");
  }

  assertCanManageTeam(workspace.role);

  return { supabase, user, workspace, admin: createAdminClient() };
}

export async function inviteTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  try {
    const { user, workspace, admin } = await requireTeamManager();

    const emailInput = (formData.get("email") as string) ?? "";
    const roleInput = (formData.get("role") as string) ?? "member";

    const emailError = validateInvitationEmail(emailInput);
    if (emailError) {
      return { error: emailError };
    }

    const role = parseInvitableRole(roleInput);
    if (!role) {
      return { error: "Select a valid role." };
    }

    assertCanInviteRole(workspace.role, role);

    const normalizedEmail = normalizeInvitationEmail(emailInput);

    if (user.email && emailsMatch(user.email, normalizedEmail)) {
      return { error: "You are already a member of this workspace." };
    }

    if (await isEmailAlreadyWorkspaceMember(admin, workspace.id, normalizedEmail)) {
      return { error: "This user is already a member of the workspace." };
    }

    const existingInvite = await getPendingInvitationForEmail(
      admin,
      workspace.id,
      normalizedEmail
    );
    if (existingInvite && !isInvitationExpired(existingInvite)) {
      return { error: "A pending invitation already exists for this email." };
    }

    await assertCanAddTeamSeat(admin, workspace.id, user.id);

    const { inviteUrl } = await createWorkspaceInvitation(admin, {
      workspaceId: workspace.id,
      email: normalizedEmail,
      role,
      invitedBy: user.id,
    });

    await sendTeamInvitationEmail({
      to: normalizedEmail,
      workspaceName: workspace.name,
      role,
      inviteUrl,
      invitedByName:
        (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null,
    });

    revalidateTeamPaths();

    return {
      success: `Invitation created for ${normalizedEmail}.`,
      inviteUrl,
    };
  } catch (error) {
    return {
      error:
        error instanceof TeamAccessError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create invitation.",
    };
  }
}

export async function cancelInvitationAction(
  invitationId: string
): Promise<TeamActionState> {
  try {
    const { workspace, admin } = await requireTeamManager();

    if (!invitationId?.trim()) {
      return { error: "Invitation id is required." };
    }

    await cancelWorkspaceInvitation(admin, workspace.id, invitationId.trim());
    revalidateTeamPaths();
    return { success: "Invitation canceled." };
  } catch (error) {
    return {
      error:
        error instanceof TeamAccessError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to cancel invitation.",
    };
  }
}

export async function resendInvitationAction(
  invitationId: string
): Promise<TeamActionState> {
  try {
    const { user, workspace, admin } = await requireTeamManager();

    if (!invitationId?.trim()) {
      return { error: "Invitation id is required." };
    }

    await assertCanAddTeamSeat(admin, workspace.id, user.id);

    const { inviteUrl } = await resendWorkspaceInvitation(
      admin,
      workspace.id,
      invitationId.trim()
    );

    revalidateTeamPaths();
    return {
      success: "Invitation renewed with a new link.",
      inviteUrl,
    };
  } catch (error) {
    return {
      error:
        error instanceof TeamAccessError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to resend invitation.",
    };
  }
}

export async function removeTeamMemberAction(
  memberId: string
): Promise<TeamActionState> {
  try {
    const { user, workspace, admin } = await requireTeamManager();

    if (!memberId?.trim()) {
      return { error: "Member id is required." };
    }

    const member = await getWorkspaceMemberById(
      admin,
      workspace.id,
      memberId.trim()
    );

    if (!member) {
      return { error: "Member not found." };
    }

    if (member.user_id === user.id) {
      return { error: "You cannot remove yourself from the workspace." };
    }

    assertCanRemoveMember(workspace.role, member.role);

    if (member.role === "owner") {
      const ownerCount = await countWorkspaceOwners(admin, workspace.id);
      if (ownerCount <= 1) {
        return { error: "The workspace must have at least one owner." };
      }
    }

    await removeWorkspaceMember(admin, workspace.id, member.id);
    revalidateTeamPaths();
    return { success: "Team member removed." };
  } catch (error) {
    return {
      error:
        error instanceof TeamAccessError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to remove member.",
    };
  }
}

export async function acceptInvitationAction(
  token: string
): Promise<TeamActionState> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to accept an invitation." };
  }

  if (!token?.trim()) {
    return { error: "Invalid invitation link." };
  }

  try {
    const invitation = await findInvitationByToken(admin, token.trim());

    if (!invitation) {
      return { error: "Invitation not found." };
    }

    if (invitation.status === "accepted") {
      return { success: "You have already joined this workspace." };
    }

    if (invitation.status === "canceled") {
      return { error: "This invitation was canceled." };
    }

    if (isInvitationExpired(invitation)) {
      if (invitation.status === "pending") {
        await markInvitationExpired(admin, invitation.id);
      }
      return { error: "This invitation has expired. Ask for a new invite." };
    }

    if (!user.email || !emailsMatch(user.email, invitation.email)) {
      return {
        error: `Sign in with ${invitation.email} to accept this invitation.`,
      };
    }

    const existing = await getWorkspaceMemberByUserId(
      admin,
      invitation.workspace_id,
      user.id
    );

    if (existing) {
      await acceptWorkspaceInvitation(admin, {
        invitationId: invitation.id,
        userId: user.id,
      });
      revalidateTeamPaths();
      return { success: "You are already a member of this workspace." };
    }

    await assertCanAddTeamSeat(admin, invitation.workspace_id, user.id);

    await addWorkspaceMember(admin, {
      workspaceId: invitation.workspace_id,
      userId: user.id,
      role: invitation.role,
    });

    await acceptWorkspaceInvitation(admin, {
      invitationId: invitation.id,
      userId: user.id,
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("default_workspace_id")
      .eq("user_id", user.id)
      .limit(1);

    if (!profile?.[0]?.default_workspace_id) {
      await admin
        .from("profiles")
        .update({ default_workspace_id: invitation.workspace_id })
        .eq("user_id", user.id);
    }

    revalidateTeamPaths();
    revalidatePath("/dashboard");

    return { success: "Welcome to the workspace!" };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to accept invitation.",
    };
  }
}

export type InvitationPreview = {
  workspaceName: string;
  email: string;
  role: InvitableRole;
  status: string;
  expiresAt: string;
  expired: boolean;
  canAccept: boolean;
};

export async function getInvitationPreview(
  token: string
): Promise<InvitationPreview | null> {
  const admin = createAdminClient();
  const invitation = await findInvitationByToken(admin, token.trim());

  if (!invitation) {
    return null;
  }

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", invitation.workspace_id)
    .limit(1);

  const expired = isInvitationExpired(invitation);

  return {
    workspaceName: workspace?.[0]?.name ?? "Workspace",
    email: invitation.email,
    role: invitation.role,
    status: expired && invitation.status === "pending" ? "expired" : invitation.status,
    expiresAt: invitation.expires_at,
    expired,
    canAccept: invitation.status === "pending" && !expired,
  };
}
