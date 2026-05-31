import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export type WorkspaceMemberWithProfile = WorkspaceMember & {
  full_name: string | null;
  email: string | null;
};

function firstRow<T>(rows: T[] | null | undefined): T | null {
  return rows?.[0] ?? null;
}

export async function listWorkspaceMembers(
  supabase: Client,
  workspaceId: string
): Promise<WorkspaceMemberWithProfile[]> {
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list workspace members: ${error.message}`);
  }

  if (!members?.length) {
    return [];
  }

  const userIds = members.map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(`Failed to load member profiles: ${profilesError.message}`);
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return members.map((member) => {
    const profile = profileById.get(member.user_id);
    return {
      ...member,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    };
  });
}

export async function countWorkspaceMembers(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to count workspace members: ${error.message}`);
  }

  return count ?? 0;
}

export async function countWorkspaceOwners(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "owner");

  if (error) {
    throw new Error(`Failed to count workspace owners: ${error.message}`);
  }

  return count ?? 0;
}

export async function getWorkspaceMemberById(
  supabase: Client,
  workspaceId: string,
  memberId: string
): Promise<WorkspaceMember | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", memberId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace member: ${error.message}`);
  }

  return firstRow(data);
}

export async function getWorkspaceMemberByUserId(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<WorkspaceMember | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace membership: ${error.message}`);
  }

  return firstRow(data);
}

export async function isEmailAlreadyWorkspaceMember(
  supabase: Client,
  workspaceId: string,
  email: string
): Promise<boolean> {
  const { normalizeInvitationEmail } = await import("@/lib/team/validation");
  const normalized = normalizeInvitationEmail(email);

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("email", normalized)
    .limit(1);

  if (profileError) {
    throw new Error(`Failed to lookup invitee profile: ${profileError.message}`);
  }

  const userId = profiles?.[0]?.user_id;
  if (!userId) {
    return false;
  }

  const member = await getWorkspaceMemberByUserId(supabase, workspaceId, userId);
  return Boolean(member);
}

export async function addWorkspaceMember(
  supabase: Client,
  input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }
): Promise<WorkspaceMember> {
  const { data, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      role: input.role,
    })
    .select("*")
    .limit(1);

  if (error) {
    throw new Error(`Failed to add workspace member: ${error.message}`);
  }

  const row = firstRow(data);
  if (!row) {
    throw new Error("Workspace member insert returned no row.");
  }

  return row;
}

export async function removeWorkspaceMember(
  supabase: Client,
  workspaceId: string,
  memberId: string
): Promise<void> {
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", memberId);

  if (error) {
    throw new Error(`Failed to remove workspace member: ${error.message}`);
  }
}

export async function countPendingInvitations(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("workspace_invitations")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  if (error) {
    throw new Error(`Failed to count pending invitations: ${error.message}`);
  }

  return count ?? 0;
}
