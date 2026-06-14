/** Provenance + initial assignee for new leads (P0: both set to the same user). */
export function buildLeadAssignmentFields(userId: string): {
  user_id: string;
  assigned_user_id: string;
} {
  return {
    user_id: userId,
    assigned_user_id: userId,
  };
}
