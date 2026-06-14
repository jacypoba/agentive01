import { isQualifiedLeadStatus } from "@/lib/analytics/qualification-metrics";
import type { LeadStatus } from "@/types/database";

export type LeadAssigneeAnalyticsRow = {
  created_at: string;
  status: LeadStatus;
  assigned_user_id: string | null;
};

export type VisitAssigneeAnalyticsRow = {
  created_at: string;
  assigned_user_id: string | null;
};

export type FollowUpAssigneeAnalyticsRow = {
  sent_at: string;
  assigned_user_id: string | null;
};

export type AgentPerformanceMember = {
  userId: string;
  label: string;
};

export type AgentPerformanceRow = {
  assigneeId: string | null;
  agentLabel: string;
  leads: number;
  qualified: number;
  conversionRate: number;
  visits: number;
  followUpsSent: number;
  isUnassigned: boolean;
};

export const UNASSIGNED_BUCKET_KEY = "__unassigned__";

type AssigneeCounts = {
  leads: number;
  qualified: number;
  visits: number;
  followUpsSent: number;
};

function emptyCounts(): AssigneeCounts {
  return { leads: 0, qualified: 0, visits: 0, followUpsSent: 0 };
}

/** Maps assignee to member row or unassigned bucket (includes non-members). */
export function resolveAssigneeBucketKey(
  assignedUserId: string | null,
  memberIds: Set<string>
): string {
  if (assignedUserId == null) {
    return UNASSIGNED_BUCKET_KEY;
  }

  if (memberIds.has(assignedUserId)) {
    return assignedUserId;
  }

  return UNASSIGNED_BUCKET_KEY;
}

export function computeAgentConversionRate(
  qualified: number,
  leads: number
): number {
  if (leads <= 0) {
    return 0;
  }

  return Math.round((qualified / leads) * 100);
}

export function aggregateAgentPerformance(input: {
  members: AgentPerformanceMember[];
  leadRows: LeadAssigneeAnalyticsRow[];
  visitRows: VisitAssigneeAnalyticsRow[];
  followUpRows: FollowUpAssigneeAnalyticsRow[];
}): AgentPerformanceRow[] {
  const memberIds = new Set(input.members.map((member) => member.userId));
  const counts = new Map<string, AssigneeCounts>();

  for (const member of input.members) {
    counts.set(member.userId, emptyCounts());
  }

  counts.set(UNASSIGNED_BUCKET_KEY, emptyCounts());

  for (const row of input.leadRows) {
    const key = resolveAssigneeBucketKey(row.assigned_user_id, memberIds);
    const bucket = counts.get(key) ?? emptyCounts();
    bucket.leads += 1;

    if (isQualifiedLeadStatus(row.status)) {
      bucket.qualified += 1;
    }

    counts.set(key, bucket);
  }

  for (const row of input.visitRows) {
    const key = resolveAssigneeBucketKey(row.assigned_user_id, memberIds);
    const bucket = counts.get(key) ?? emptyCounts();
    bucket.visits += 1;
    counts.set(key, bucket);
  }

  for (const row of input.followUpRows) {
    const key = resolveAssigneeBucketKey(row.assigned_user_id, memberIds);
    const bucket = counts.get(key) ?? emptyCounts();
    bucket.followUpsSent += 1;
    counts.set(key, bucket);
  }

  const memberRows: AgentPerformanceRow[] = input.members.map((member) => {
    const bucket = counts.get(member.userId) ?? emptyCounts();

    return {
      assigneeId: member.userId,
      agentLabel: member.label,
      leads: bucket.leads,
      qualified: bucket.qualified,
      conversionRate: computeAgentConversionRate(bucket.qualified, bucket.leads),
      visits: bucket.visits,
      followUpsSent: bucket.followUpsSent,
      isUnassigned: false,
    };
  });

  const unassigned = counts.get(UNASSIGNED_BUCKET_KEY) ?? emptyCounts();

  return [
    ...memberRows,
    {
      assigneeId: null,
      agentLabel: "Unassigned",
      leads: unassigned.leads,
      qualified: unassigned.qualified,
      conversionRate: computeAgentConversionRate(
        unassigned.qualified,
        unassigned.leads
      ),
      visits: unassigned.visits,
      followUpsSent: unassigned.followUpsSent,
      isUnassigned: true,
    },
  ];
}
