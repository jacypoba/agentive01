/** Returns true when a row belongs to the active workspace feed scope. */
export function belongsToWorkspace(
  entity: { workspace_id: string | null } | null | undefined,
  workspaceId: string
): boolean {
  if (!entity?.workspace_id) {
    return false;
  }

  return entity.workspace_id === workspaceId;
}
