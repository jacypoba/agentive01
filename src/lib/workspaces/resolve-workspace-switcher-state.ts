import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDefaultWorkspace } from "@/lib/workspaces/ensure-default-workspace";
import {
  getCurrentWorkspaceId,
  listUserWorkspaces,
  type CurrentWorkspace,
} from "@/lib/workspaces/get-current-workspace";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type WorkspaceSwitcherState = {
  workspaces: CurrentWorkspace[];
  currentWorkspaceId: string | null;
  isUnset: boolean;
};

/**
 * Loads workspace switcher data for the header, provisioning a default workspace
 * when the user is authenticated but has none yet.
 */
export async function resolveWorkspaceSwitcherState(
  supabase: Client,
  userId: string,
  workspaceNameHint?: string
): Promise<WorkspaceSwitcherState> {
  let workspaces = await listUserWorkspaces(supabase, userId);

  if (workspaces.length === 0) {
    await ensureDefaultWorkspace(userId, workspaceNameHint);
    workspaces = await listUserWorkspaces(supabase, userId);
  }

  if (workspaces.length === 0) {
    return {
      workspaces: [],
      currentWorkspaceId: null,
      isUnset: true,
    };
  }

  const currentWorkspaceId =
    (await getCurrentWorkspaceId(supabase, userId)) ?? workspaces[0]?.id ?? null;

  return {
    workspaces,
    currentWorkspaceId,
    isUnset: false,
  };
}
