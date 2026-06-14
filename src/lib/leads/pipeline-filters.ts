import { isQualifiedLeadStatus } from "@/lib/analytics/qualification-metrics";
import type { Lead, LeadStatus } from "@/types/database";

export type LeadPipelineFilter = "qualified";

export function parsePipelineFilterParam(
  value: string | undefined
): LeadPipelineFilter | undefined {
  return value === "qualified" ? "qualified" : undefined;
}

export function isLeadInPipeline(
  status: LeadStatus,
  pipeline: LeadPipelineFilter
): boolean {
  if (pipeline === "qualified") {
    return isQualifiedLeadStatus(status);
  }

  return true;
}

export function filterLeadsByPipeline(
  leads: Lead[],
  pipeline: LeadPipelineFilter | undefined
): Lead[] {
  if (!pipeline) {
    return leads;
  }

  return leads.filter((lead) => isLeadInPipeline(lead.status, pipeline));
}

export function countLeadsByPipeline(
  leads: Lead[],
  pipeline: LeadPipelineFilter | undefined
): number {
  return filterLeadsByPipeline(leads, pipeline).length;
}
