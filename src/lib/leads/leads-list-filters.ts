import { filterLeadsByAssignee } from "@/lib/leads/assignment-filters";
import type { LeadAssigneeFilter } from "@/lib/leads/assignment-filters";
import {
  filterLeadsByPipeline,
  type LeadPipelineFilter,
} from "@/lib/leads/pipeline-filters";
import { isTimestampInAnalyticsPeriod } from "@/lib/analytics/period-filters";
import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import type { Lead, LeadStatus } from "@/types/database";

export type LeadsListScopeInput = {
  assigneeFilter: LeadAssigneeFilter;
  pipeline?: LeadPipelineFilter;
  period?: AnalyticsPeriodKey;
  currentUserId: string;
};

/** Pipeline drill-downs use group semantics; never seed exact status=qualified. */
export function resolveInitialStatusFilter(
  initialStatus: LeadStatus | undefined,
  initialPipeline: LeadPipelineFilter | undefined
): LeadStatus | "all" {
  if (initialPipeline === "qualified") {
    return "all";
  }

  return initialStatus ?? "all";
}

/** Leads visible in the table/chips before status tab and search filtering. */
export function buildLeadsScopeBeforeStatusFilter(
  leads: Lead[],
  input: LeadsListScopeInput
): Lead[] {
  let result = filterLeadsByAssignee(
    leads,
    input.assigneeFilter,
    input.currentUserId
  );
  result = filterLeadsByPipeline(result, input.pipeline);

  if (input.period) {
    result = result.filter((lead) =>
      isTimestampInAnalyticsPeriod(lead.created_at, input.period!)
    );
  }

  return result;
}

export function filterLeadsByStatusTab(
  leads: Lead[],
  statusFilter: LeadStatus | "all"
): Lead[] {
  if (statusFilter === "all") {
    return leads;
  }

  return leads.filter((lead) => lead.status === statusFilter);
}

export function buildLeadsListFilterKey(input: {
  initialPipeline?: LeadPipelineFilter;
  initialStatus?: LeadStatus;
  initialPeriod?: AnalyticsPeriodKey;
  initialAssigneeFilter?: LeadAssigneeFilter;
}): string {
  return [
    input.initialPipeline ?? "",
    input.initialStatus ?? "",
    input.initialPeriod ?? "",
    input.initialAssigneeFilter ?? "",
  ].join("|");
}
