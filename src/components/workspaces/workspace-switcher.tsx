import { WorkspaceSwitcherClient } from "@/components/workspaces/workspace-switcher-client";
import {
  WORKSPACE_FALLBACK_LABEL,
  WorkspacePillFallback,
} from "@/components/workspaces/workspace-pill";
import { getProfile } from "@/lib/data/profiles";
import { resolveWorkspaceSwitcherState } from "@/lib/workspaces/resolve-workspace-switcher-state";
import { createClient } from "@/lib/supabase/server";

type WorkspaceSwitcherProps = {
  userId: string;
};

function resolveDisplayName(
  workspaces: Awaited<
    ReturnType<typeof resolveWorkspaceSwitcherState>
  >["workspaces"],
  currentWorkspaceId: string | null,
  isUnset: boolean
): string {
  if (isUnset || workspaces.length === 0) {
    return WORKSPACE_FALLBACK_LABEL;
  }

  const current =
    workspaces.find((workspace) => workspace.id === currentWorkspaceId) ??
    workspaces[0];

  return current?.name?.trim() || WORKSPACE_FALLBACK_LABEL;
}

export async function WorkspaceSwitcher({ userId }: WorkspaceSwitcherProps) {
  const supabase = await createClient();

  let profileName: string | undefined;
  try {
    const profile = await getProfile(supabase, userId);
    profileName = profile?.full_name ?? profile?.email?.split("@")[0] ?? undefined;
  } catch {
    // Profile may be unavailable; provisioning still uses a default name.
  }

  try {
    const state = await resolveWorkspaceSwitcherState(
      supabase,
      userId,
      profileName
    );

    const currentWorkspaceName = resolveDisplayName(
      state.workspaces,
      state.currentWorkspaceId,
      state.isUnset
    );

    console.log("[WORKSPACE SWITCHER]", {
      userId,
      workspaceCount: state.workspaces.length,
      currentWorkspaceName,
    });

    return (
      <WorkspaceSwitcherClient
        workspaces={state.workspaces}
        currentWorkspaceId={state.currentWorkspaceId}
        fallbackLabel={currentWorkspaceName}
        isUnset={state.isUnset}
      />
    );
  } catch (error) {
    console.log("[WORKSPACE SWITCHER]", {
      userId,
      workspaceCount: 0,
      currentWorkspaceName: WORKSPACE_FALLBACK_LABEL,
      error: error instanceof Error ? error.message : "unknown",
    });

    return <WorkspacePillFallback />;
  }
}
