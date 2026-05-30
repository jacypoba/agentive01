export { ensureDefaultWorkspace } from "@/lib/workspaces/ensure-default-workspace";
export { resolveWorkspaceIdForInsert, resolveWorkspaceIdForSystemInsert } from "@/lib/workspaces/resolve-workspace-id-for-insert";
export { resolveWhatsAppTenantContext } from "@/lib/workspaces/resolve-whatsapp-tenant";
export {
  getCurrentWorkspace,
  getCurrentWorkspaceId,
  listUserWorkspaces,
  resolveWorkspaceIdForUser,
} from "@/lib/workspaces/get-current-workspace";
export type { CurrentWorkspace } from "@/lib/workspaces/get-current-workspace";
export type { ResolveWorkspaceIdInput } from "@/lib/workspaces/resolve-workspace-id-for-insert";
export type { WhatsAppTenantContext } from "@/lib/workspaces/resolve-whatsapp-tenant";
export {
  resolveWorkspaceSwitcherState,
  type WorkspaceSwitcherState,
} from "@/lib/workspaces/resolve-workspace-switcher-state";
export {
  assertWorkspaceAccess,
  assertWorkspaceAccessOrThrow,
  getActiveWorkspace,
  getUserWorkspaces,
  requireActiveWorkspaceId,
  requireEntityWorkspaceId,
  requireLeadWorkspaceId,
  resolveTenantScope,
  WorkspaceAccessError,
  type TenantScope,
} from "@/lib/workspaces/workspace-access";
