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

async function fetchWorkspaceById(
  supabase: Client,
  workspaceId: string
): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace: ${error.message}`);
  }

  return firstRow(data);
}

async function getMembershipForWorkspace(
  supabase: Client,
  userId: string,
  workspaceId: string
): Promise<(WorkspaceMember & { workspaces: Workspace }) | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace membership: ${error.message}`);
  }

  const membership = firstRow(data);
  if (!membership) {
    return null;
  }

  const workspace = await fetchWorkspaceById(supabase, workspaceId);
  if (!workspace) {
    return null;
  }

  return { ...membership, workspaces: workspace };
}

async function getFirstMembership(
  supabase: Client,
  userId: string
): Promise<(WorkspaceMember & { workspaces: Workspace }) | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace memberships: ${error.message}`);
  }

  const membership = firstRow(data);
  if (!membership) {
    return null;
  }

  const workspace = await fetchWorkspaceById(supabase, membership.workspace_id);
  if (!workspace) {
    return null;
  }

  return { ...membership, workspaces: workspace };
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
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list workspace memberships: ${error.message}`);
  }

  if (!members?.length) {
    return [];
  }

  const workspaceIds = members.map((member) => member.workspace_id);
  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds);

  if (workspacesError) {
    throw new Error(`Failed to list workspaces: ${workspacesError.message}`);
  }

  const workspaceById = new Map(
    (workspaces ?? []).map((workspace) => [workspace.id, workspace])
  );

  return members.flatMap((member) => {
    const workspace = workspaceById.get(member.workspace_id);
    if (!workspace) {
      return [];
    }

    return [toCurrentWorkspace({ ...member, workspaces: workspace })];
  });
}
