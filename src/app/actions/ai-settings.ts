"use server";

import { revalidatePath } from "next/cache";
import {
  getOrCreateWorkspaceSettings,
  updateWorkspaceSettings,
} from "@/lib/data/workspace-settings";
import {
  parseWorkspaceAISettingsFromFormData,
  validateWorkspaceAISettingsInput,
} from "@/lib/workspace-settings/validation";
import { getCurrentWorkspace } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";

export type AiSettingsState = {
  error?: string;
  success?: string;
};

const ADMIN_ROLES = new Set(["owner", "admin"]);

export async function saveAiSettingsAction(
  _prev: AiSettingsState,
  formData: FormData
): Promise<AiSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const workspace = await getCurrentWorkspace(supabase, user.id);
  if (!workspace) {
    return { error: "No active workspace found." };
  }

  if (!ADMIN_ROLES.has(workspace.role)) {
    return { error: "Only workspace owners and admins can update AI settings." };
  }

  const parsed = parseWorkspaceAISettingsFromFormData(formData);
  const validation = validateWorkspaceAISettingsInput(parsed);
  if (!validation.ok) {
    return { error: validation.error };
  }

  try {
    await updateWorkspaceSettings(supabase, workspace.id, validation.value);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to save AI settings.",
    };
  }

  revalidatePath("/settings/ai");
  revalidatePath("/dashboard");
  return { success: "AI assistant settings saved." };
}

export async function loadActiveWorkspaceAiSettingsAction(): Promise<{
  error?: string;
  settings?: Awaited<ReturnType<typeof getOrCreateWorkspaceSettings>>;
  workspaceName?: string;
  canEdit?: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const workspace = await getCurrentWorkspace(supabase, user.id);
  if (!workspace) {
    return { error: "No active workspace found." };
  }

  try {
    const settings = await getOrCreateWorkspaceSettings(supabase, workspace.id);
    return {
      settings,
      workspaceName: workspace.name,
      canEdit: ADMIN_ROLES.has(workspace.role),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to load workspace AI settings.",
    };
  }
}
