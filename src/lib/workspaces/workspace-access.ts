import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentWorkspace,
  getCurrentWorkspaceId,
  listUserWorkspaces,
  type CurrentWorkspace,
} from "@/lib/workspaces/get-current-workspace";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type TenantScope = {
  userId: string;
  workspaceId: string;
};

export class WorkspaceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

/** Alias for getCurrentWorkspace — active workspace for the signed-in user. */
export const getActiveWorkspace = getCurrentWorkspace;

/** Alias for listUserWorkspaces. */
export const getUserWorkspaces = listUserWorkspaces;

/**
 * Returns the active workspace id or throws when the user has no membership.
 */
export async function requireActiveWorkspaceId(
  supabase: Client,
  userId: string
): Promise<string> {
  const workspaceId = await getCurrentWorkspaceId(supabase, userId);
  if (!workspaceId) {
    throw new WorkspaceAccessError(
      "No active workspace. Complete onboarding or contact support."
    );
  }
  return workspaceId;
}

/**
 * Resolves user + active workspace for tenant-scoped reads and writes.
 */
export async function resolveTenantScope(
  supabase: Client,
  userId: string
): Promise<TenantScope> {
  const workspaceId = await requireActiveWorkspaceId(supabase, userId);
  return { userId, workspaceId };
}

/**
 * Verifies the user belongs to the workspace. Throws on denied access.
 */
export async function assertWorkspaceAccess(
  supabase: Client,
  userId: string,
  workspaceId: string
): Promise<CurrentWorkspace> {
  const trimmed = workspaceId.trim();
  if (!trimmed) {
    throw new WorkspaceAccessError("Workspace id is required.");
  }

  const workspaces = await listUserWorkspaces(supabase, userId);
  const membership = workspaces.find((workspace) => workspace.id === trimmed);

  if (!membership) {
    throw new WorkspaceAccessError(
      "Access denied: you are not a member of this workspace."
    );
  }

  return membership;
}

/**
 * Validates client-supplied workspace_id before using it in writes.
 */
export async function assertWorkspaceAccessOrThrow(
  supabase: Client,
  userId: string,
  workspaceId: string | null | undefined
): Promise<string> {
  if (!workspaceId) {
    return requireActiveWorkspaceId(supabase, userId);
  }

  await assertWorkspaceAccess(supabase, userId, workspaceId);
  return workspaceId;
}

export function requireEntityWorkspaceId(
  entity: { workspace_id?: string | null },
  entityLabel = "Record"
): string {
  if (!entity.workspace_id) {
    throw new Error(`${entityLabel} is not associated with a workspace.`);
  }
  return entity.workspace_id;
}

/** Resolves workspace_id from a lead row (required for tenant-scoped operations). */
export function requireLeadWorkspaceId(lead: {
  id: string;
  workspace_id?: string | null;
}): string {
  return requireEntityWorkspaceId(lead, `Lead ${lead.id}`);
}
