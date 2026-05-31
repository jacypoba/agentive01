import type { InvitableRole, WorkspaceRole } from "@/types/database";

export type { InvitableRole };

export class TeamAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamAccessError";
  }
}

const MANAGEMENT_ROLES = new Set<WorkspaceRole>(["owner", "admin"]);

export function canManageTeam(role: WorkspaceRole): boolean {
  return MANAGEMENT_ROLES.has(role);
}

/** Roles the actor may assign when sending an invitation. */
export function getInvitableRoles(actorRole: WorkspaceRole): InvitableRole[] {
  if (actorRole === "owner") {
    return ["admin", "member"];
  }
  if (actorRole === "admin") {
    return ["member"];
  }
  return [];
}

export function canInviteRole(
  actorRole: WorkspaceRole,
  inviteRole: InvitableRole
): boolean {
  return getInvitableRoles(actorRole).includes(inviteRole);
}

export function canRemoveMember(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole
): boolean {
  if (actorRole === "member") {
    return false;
  }

  if (targetRole === "owner") {
    return false;
  }

  if (actorRole === "admin") {
    return targetRole === "member";
  }

  return actorRole === "owner" && (targetRole === "admin" || targetRole === "member");
}

export function assertCanManageTeam(role: WorkspaceRole): void {
  if (!canManageTeam(role)) {
    throw new TeamAccessError(
      "Only workspace owners and admins can manage team members."
    );
  }
}

export function assertCanInviteRole(
  actorRole: WorkspaceRole,
  inviteRole: InvitableRole
): void {
  assertCanManageTeam(actorRole);

  if (!canInviteRole(actorRole, inviteRole)) {
    throw new TeamAccessError(
      actorRole === "admin"
        ? "Admins can only invite members."
        : "You cannot invite users with that role."
    );
  }
}

export function assertCanRemoveMember(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole
): void {
  if (!canRemoveMember(actorRole, targetRole)) {
    if (targetRole === "owner") {
      throw new TeamAccessError("The workspace owner cannot be removed.");
    }
    throw new TeamAccessError("You do not have permission to remove this member.");
  }
}
