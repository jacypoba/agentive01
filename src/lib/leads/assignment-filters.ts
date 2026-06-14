import type { Lead } from "@/types/database";

export type LeadAssigneeFilter = "all" | "me" | "unassigned";

export function filterLeadsByAssignee(
  leads: Lead[],
  assigneeFilter: LeadAssigneeFilter,
  currentUserId: string
): Lead[] {
  if (assigneeFilter === "me") {
    return leads.filter((lead) => lead.assigned_user_id === currentUserId);
  }

  if (assigneeFilter === "unassigned") {
    return leads.filter((lead) => lead.assigned_user_id == null);
  }

  return leads;
}

export function countLeadsByAssignee(
  leads: Lead[],
  assigneeFilter: LeadAssigneeFilter,
  currentUserId: string
): number {
  return filterLeadsByAssignee(leads, assigneeFilter, currentUserId).length;
}
