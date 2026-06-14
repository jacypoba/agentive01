import {
  buildInboxPipelineScope,
  filterLeadsByInboxQueue,
  type InboxQueueFilter,
} from "@/lib/leads/inbox-attention";
import type { LeadPipelineFilter } from "@/lib/leads/pipeline-filters";
import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import type { Lead, LeadForInbox, LeadStatus } from "@/types/database";

export type { InboxQueueFilter };

export type LeadsListScopeInput = {
  queueFilter: InboxQueueFilter;
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

/** Leads visible in the inbox before status tab and search filtering. */
export function buildLeadsScopeBeforeStatusFilter<T extends LeadForInbox>(
  leads: T[],
  input: LeadsListScopeInput
): T[] {
  const pipelineScoped = buildInboxPipelineScope(leads, {
    pipeline: input.pipeline,
    period: input.period,
  });

  return filterLeadsByInboxQueue(
    pipelineScoped,
    input.queueFilter,
    input.currentUserId
  );
}

export function filterLeadsByStatusTab<T extends Lead>(
  leads: T[],
  statusFilter: LeadStatus | "all"
): T[] {
  if (statusFilter === "all") {
    return leads;
  }

  return leads.filter((lead) => lead.status === statusFilter);
}

export function buildLeadsListFilterKey(input: {
  initialPipeline?: LeadPipelineFilter;
  initialStatus?: LeadStatus;
  initialPeriod?: AnalyticsPeriodKey;
  initialQueueFilter?: InboxQueueFilter;
}): string {
  return [
    input.initialPipeline ?? "",
    input.initialStatus ?? "",
    input.initialPeriod ?? "",
    input.initialQueueFilter ?? "",
  ].join("|");
}
