"use server";

import { revalidatePath } from "next/cache";
import { updateProfile } from "@/lib/data/profiles";
import { listUserWorkspaces } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";

export type SwitchWorkspaceState = {
  error?: string;
  success?: boolean;
};

const REVALIDATE_PATHS = [
  "/dashboard",
  "/leads",
  "/visits",
  "/follow-ups",
  "/properties",
  "/settings",
];

export async function switchDefaultWorkspaceAction(
  workspaceId: string
): Promise<SwitchWorkspaceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!workspaceId.trim()) {
    return { error: "Invalid workspace." };
  }

  try {
    const workspaces = await listUserWorkspaces(supabase, user.id);
    const membership = workspaces.find((workspace) => workspace.id === workspaceId);

    if (!membership) {
      return { error: "Workspace not found or access denied." };
    }

    await updateProfile(supabase, user.id, {
      default_workspace_id: workspaceId,
    });

    for (const path of REVALIDATE_PATHS) {
      revalidatePath(path, "layout");
    }

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to switch workspace.",
    };
  }
}
