import { WorkspaceSwitcherClient } from "@/components/workspaces/workspace-switcher-client";
import {
  getCurrentWorkspace,
  listUserWorkspaces,
} from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";

type WorkspaceSwitcherProps = {
  userId: string;
};

export async function WorkspaceSwitcher({ userId }: WorkspaceSwitcherProps) {
  const supabase = await createClient();

  try {
    const [workspaces, currentWorkspace] = await Promise.all([
      listUserWorkspaces(supabase, userId),
      getCurrentWorkspace(supabase, userId),
    ]);

    if (workspaces.length === 0) {
      return null;
    }

    const currentWorkspaceId =
      currentWorkspace?.id ?? workspaces[0]?.id ?? null;

    if (!currentWorkspaceId) {
      return null;
    }

    return (
      <WorkspaceSwitcherClient
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
      />
    );
  } catch {
    return null;
  }
}
