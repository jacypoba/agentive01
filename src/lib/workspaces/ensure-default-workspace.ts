import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NAME = "Default workspace";

/**
 * Idempotently ensures the user has at least one workspace (via DB RPC).
 * Prefers the service-role client; falls back to the authenticated session RPC.
 */
export async function ensureDefaultWorkspace(
  userId: string,
  workspaceName?: string
): Promise<string | null> {
  const name = workspaceName?.trim() || DEFAULT_NAME;

  const adminResult = await provisionViaAdmin(userId, name);
  if (adminResult) {
    return adminResult;
  }

  return provisionViaSession(userId, name);
}

async function provisionViaAdmin(
  userId: string,
  workspaceName: string
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("provision_default_workspace", {
      p_user_id: userId,
      p_workspace_name: workspaceName,
    });

    if (error) {
      console.error(
        "[workspaces] provision via admin failed:",
        error.message
      );
      return null;
    }

    return typeof data === "string" ? data : null;
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("SUPABASE_SERVICE_ROLE_KEY")
    ) {
      return null;
    }

    console.error("[workspaces] provision via admin error:", err);
    return null;
  }
}

async function provisionViaSession(
  userId: string,
  workspaceName: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("provision_default_workspace", {
      p_user_id: userId,
      p_workspace_name: workspaceName,
    });

    if (error) {
      console.error(
        "[workspaces] provision via session RPC failed:",
        error.message
      );
      return null;
    }

    return typeof data === "string" ? data : null;
  } catch (err) {
    console.error("[workspaces] provision via session RPC error:", err);
    return null;
  }
}
