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
 * Priority: explicit value → lead.workspace_id → user's current workspace → null.
 * Null is allowed so legacy user_id-only writes keep working during transition.
 */
export async function resolveWorkspaceIdForInsert(
  supabase: Client,
  input: ResolveWorkspaceIdInput
): Promise<string | null> {
  if (input.workspaceId) {
    return input.workspaceId;
  }

  if (input.leadId) {
    const { data, error } = await supabase
      .from("leads")
      .select("workspace_id")
      .eq("id", input.leadId)
      .maybeSingle();

    if (!error && data?.workspace_id) {
      return data.workspace_id;
    }
  }

  try {
    return await getCurrentWorkspaceId(supabase, input.userId);
  } catch {
    return null;
  }
}
