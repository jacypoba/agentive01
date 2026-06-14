import type { LeadStatus } from "@/types/database";

/** Leads that reached at least qualified stage in the CRM pipeline. */
export const QUALIFIED_LEAD_STATUSES: LeadStatus[] = [
  "qualified",
  "scheduled",
  "closed",
];

export function isQualifiedLeadStatus(status: LeadStatus): boolean {
  return QUALIFIED_LEAD_STATUSES.includes(status);
}

export function countQualifiedLeads(
  rows: { status: LeadStatus }[]
): number {
  return rows.filter((row) => isQualifiedLeadStatus(row.status)).length;
}
