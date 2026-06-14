"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspaceSubscriptionActive } from "@/lib/billing/workspace-subscription";
import { generateAiSettingsPreview, type AiPreviewResult } from "@/lib/ai/generate-ai-preview";
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

export type AiPreviewActionResult =
  | { error: string }
  | ({ ok: true } & AiPreviewResult);

const MAX_PREVIEW_MESSAGE_LENGTH = 500;

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

export async function previewAiReplyAction(
  sampleMessage: string
): Promise<AiPreviewActionResult> {
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

  const trimmed = sampleMessage.trim();
  if (!trimmed) {
    return { error: "Enter a sample lead message to preview." };
  }

  if (trimmed.length > MAX_PREVIEW_MESSAGE_LENGTH) {
    return {
      error: `Sample message must be at most ${MAX_PREVIEW_MESSAGE_LENGTH} characters.`,
    };
  }

  try {
    await assertWorkspaceSubscriptionActive(supabase, workspace.id, user.id);
    const settings = await getOrCreateWorkspaceSettings(supabase, workspace.id);
    const preview = await generateAiSettingsPreview({
      workspaceId: workspace.id,
      userId: user.id,
      settings,
      sampleMessage: trimmed,
    });

    return { ok: true, ...preview };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preview generation failed.";

    if (message.includes("OPENAI_API_KEY")) {
      return {
        error: "OpenAI is not configured on the server. Preview requires OPENAI_API_KEY.",
      };
    }

    return { error: message };
  }
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
