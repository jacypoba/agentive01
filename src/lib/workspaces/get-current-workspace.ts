import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Workspace, WorkspaceMember, WorkspaceRole } from "@/types/database";

type Client = SupabaseClient<Database>;

export type CurrentWorkspace = Workspace & {
  role: WorkspaceRole;
};

function firstRow<T>(rows: T[] | null | undefined): T | null {
  return rows?.[0] ?? null;
}

async function getProfileDefaultWorkspaceId(
  supabase: Client,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch profile workspace preference: ${error.message}`);
  }

  return firstRow(data)?.default_workspace_id ?? null;
}

async function getMembershipForWorkspace(
  supabase: Client,
  userId: string,
  workspaceId: string
): Promise<(WorkspaceMember & { workspaces: Workspace }) | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*, workspaces(*)")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace membership: ${error.message}`);
  }

  return firstRow(data as (WorkspaceMember & { workspaces: Workspace })[] | null);
}

async function getFirstMembership(
  supabase: Client,
  userId: string
): Promise<(WorkspaceMember & { workspaces: Workspace }) | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*, workspaces(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace memberships: ${error.message}`);
  }

  return firstRow(data as (WorkspaceMember & { workspaces: Workspace })[] | null);
}

function toCurrentWorkspace(
  membership: WorkspaceMember & { workspaces: Workspace }
): CurrentWorkspace {
  return {
    ...membership.workspaces,
    role: membership.role,
  };
}

/**
 * Resolves the active workspace id for a user.
 * Prefers profiles.default_workspace_id, then falls back to the earliest membership.
 */
export async function getCurrentWorkspaceId(
  supabase: Client,
  userId: string
): Promise<string | null> {
  const preferredWorkspaceId = await getProfileDefaultWorkspaceId(
    supabase,
    userId
  );

  if (preferredWorkspaceId) {
    const preferredMembership = await getMembershipForWorkspace(
      supabase,
      userId,
      preferredWorkspaceId
    );

    if (preferredMembership) {
      return preferredMembership.workspace_id;
    }
  }

  const membership = await getFirstMembership(supabase, userId);
  return membership?.workspace_id ?? null;
}

/** Alias for analytics and future tenant-scoped services. */
export const resolveWorkspaceIdForUser = getCurrentWorkspaceId;

export async function getCurrentWorkspace(
  supabase: Client,
  userId: string
): Promise<CurrentWorkspace | null> {
  const workspaceId = await getCurrentWorkspaceId(supabase, userId);

  if (!workspaceId) {
    return null;
  }

  const membership = await getMembershipForWorkspace(
    supabase,
    userId,
    workspaceId
  );

  return membership ? toCurrentWorkspace(membership) : null;
}

export async function listUserWorkspaces(
  supabase: Client,
  userId: string
): Promise<CurrentWorkspace[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*, workspaces(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list workspaces: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    toCurrentWorkspace(row as WorkspaceMember & { workspaces: Workspace })
  );
}
