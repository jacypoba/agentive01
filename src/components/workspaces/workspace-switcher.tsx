import { WorkspaceSwitcherClient } from "@/components/workspaces/workspace-switcher-client";
import { getProfile } from "@/lib/data/profiles";
import { resolveWorkspaceSwitcherState } from "@/lib/workspaces/resolve-workspace-switcher-state";
import { createClient } from "@/lib/supabase/server";

type WorkspaceSwitcherProps = {
  userId: string;
};

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

    return (
      <WorkspaceSwitcherClient
        workspaces={state.workspaces}
        currentWorkspaceId={state.currentWorkspaceId}
        isUnset={state.isUnset}
      />
    );
  } catch (error) {
    console.error("[WorkspaceSwitcher] failed to load workspaces:", error);

    return (
      <WorkspaceSwitcherClient
        workspaces={[]}
        currentWorkspaceId={null}
        isUnset
      />
    );
  }
}
