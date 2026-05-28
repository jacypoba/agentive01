export { ensureDefaultWorkspace } from "@/lib/workspaces/ensure-default-workspace";
export { resolveWorkspaceIdForInsert } from "@/lib/workspaces/resolve-workspace-id-for-insert";
export {
  getCurrentWorkspace,
  getCurrentWorkspaceId,
  listUserWorkspaces,
  resolveWorkspaceIdForUser,
} from "@/lib/workspaces/get-current-workspace";
export type { CurrentWorkspace } from "@/lib/workspaces/get-current-workspace";
export type { ResolveWorkspaceIdInput } from "@/lib/workspaces/resolve-workspace-id-for-insert";
export {
  resolveWorkspaceSwitcherState,
  type WorkspaceSwitcherState,
} from "@/lib/workspaces/resolve-workspace-switcher-state";
