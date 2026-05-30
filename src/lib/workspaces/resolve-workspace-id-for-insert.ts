import { assertWorkspaceAccessOrThrow } from "@/lib/workspaces/workspace-access";
import { getCurrentWorkspaceId } from "@/lib/workspaces/get-current-workspace";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ResolveWorkspaceIdInput = {
  userId: string;
  workspaceId?: string | null;
  leadId?: string;
};

/**
 * Resolves workspace_id for new tenant rows.
 * Priority: validated explicit value → lead.workspace_id → user's active workspace.
 * Never returns a workspace the user cannot access.
 */
export async function resolveWorkspaceIdForInsert(
  supabase: Client,
  input: ResolveWorkspaceIdInput
): Promise<string | null> {
  if (input.workspaceId) {
    return assertWorkspaceAccessOrThrow(supabase, input.userId, input.workspaceId);
  }

  if (input.leadId) {
    const { data, error } = await supabase
      .from("leads")
      .select("workspace_id")
      .eq("id", input.leadId)
      .maybeSingle();

    if (!error && data?.workspace_id) {
      await assertWorkspaceAccessOrThrow(
        supabase,
        input.userId,
        data.workspace_id
      );
      return data.workspace_id;
    }
  }

  try {
    return await getCurrentWorkspaceId(supabase, input.userId);
  } catch {
    return null;
  }
}

/**
 * Resolves workspace for webhook/system writes (admin client).
 * Does not check user membership — caller must validate routing separately.
 */
export async function resolveWorkspaceIdForSystemInsert(
  supabase: Client,
  input: {
    workspaceId: string;
    leadId?: string;
  }
): Promise<string> {
  if (input.leadId) {
    const { data } = await supabase
      .from("leads")
      .select("workspace_id")
      .eq("id", input.leadId)
      .maybeSingle();

    if (data?.workspace_id) {
      return data.workspace_id;
    }
  }

  return input.workspaceId;
}
