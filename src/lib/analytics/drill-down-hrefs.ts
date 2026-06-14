import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import { parsePipelineFilterParam } from "@/lib/leads/pipeline-filters";
import type { VisitRequestStatus } from "@/types/database";

type LeadsDrillDownParams = {
  pipeline?: "qualified";
  period?: AnalyticsPeriodKey;
  assignee?: "me" | "unassigned";
};

type VisitsDrillDownParams = {
  status?: VisitRequestStatus;
  period?: AnalyticsPeriodKey;
};

type FollowUpsDrillDownParams = {
  group?: "pending" | "sent" | "failed";
  today?: boolean;
  period?: AnalyticsPeriodKey;
};

function appendSearchParams(
  basePath: string,
  params: URLSearchParams
): string {
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function buildLeadsDrillDownHref(
  params: LeadsDrillDownParams = {}
): string {
  const search = new URLSearchParams();

  if (params.pipeline === "qualified") {
    search.set("pipeline", "qualified");
  }

  if (params.period) {
    search.set("period", params.period);
  }

  if (params.assignee) {
    search.set("assignee", params.assignee);
  }

  return appendSearchParams("/leads", search);
}

export function buildVisitsDrillDownHref(
  params: VisitsDrillDownParams = {}
): string {
  const search = new URLSearchParams();

  if (params.status) {
    search.set("status", params.status);
  }

  if (params.period) {
    search.set("period", params.period);
  }

  return appendSearchParams("/visits", search);
}

export function buildFollowUpsDrillDownHref(
  params: FollowUpsDrillDownParams = {}
): string {
  const search = new URLSearchParams();

  if (params.group) {
    search.set("group", params.group);
  }

  if (params.today) {
    search.set("today", "1");
  }

  if (params.period) {
    search.set("period", params.period);
  }

  return appendSearchParams("/follow-ups", search);
}

export function parseTodayParam(value: string | undefined): boolean {
  return value === "1";
}

export function parseDrillDownPeriodParam(
  value: string | undefined
): AnalyticsPeriodKey | undefined {
  if (value === "7" || value === "30" || value === "90" || value === "all") {
    return value;
  }

  return undefined;
}

export { parsePipelineFilterParam };
