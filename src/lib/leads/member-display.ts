import type { WorkspaceMemberWithProfile } from "@/lib/data/workspace-members";

export function formatMemberDisplayName(member: {
  full_name: string | null;
  email: string | null;
}): string {
  const name = member.full_name?.trim();
  if (name) {
    return name;
  }

  const email = member.email?.trim();
  if (email) {
    return email.split("@")[0] ?? email;
  }

  return "Team member";
}

export function buildMemberLabelMap(
  members: WorkspaceMemberWithProfile[]
): Map<string, string> {
  return new Map(
    members.map((member) => [member.user_id, formatMemberDisplayName(member)])
  );
}

export function getAssigneeLabel(
  assignedUserId: string | null,
  memberLabels: Map<string, string>
): string {
  if (!assignedUserId) {
    return "Unassigned";
  }

  return memberLabels.get(assignedUserId) ?? "Unknown member";
}
