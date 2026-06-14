import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Resolves a stable workspace user for subscription lookups (trial bootstrap, etc.).
 * Decoupled from lead.user_id / assigned_user_id — uses workspace owner, then creator.
 */
export async function resolveBillingContextUserId(
  supabase: Client,
  workspaceId: string
): Promise<string> {
  const { data: owner, error: ownerError } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownerError) {
    throw new Error(
      `Failed to resolve billing context user: ${ownerError.message}`
    );
  }

  if (owner?.user_id) {
    return owner.user_id;
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("created_by")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError) {
    throw new Error(
      `Failed to resolve billing context user: ${workspaceError.message}`
    );
  }

  if (workspace?.created_by) {
    return workspace.created_by;
  }

  throw new Error(`No billing context user for workspace ${workspaceId}`);
}
