import { filterLeadsByPipeline, type LeadPipelineFilter } from "@/lib/leads/pipeline-filters";
import { isTimestampInAnalyticsPeriod } from "@/lib/analytics/period-filters";
import type { AnalyticsPeriodKey } from "@/lib/analytics/periods";
import type { ConversationSender, LeadForInbox } from "@/types/database";

export type InboxQueueFilter =
  | "all"
  | "unread"
  | "needs_attention"
  | "me"
  | "unassigned";

export type ConversationAttentionMessage = {
  sender: ConversationSender;
  created_at: string;
};

export type InboxPipelineScopeInput = {
  pipeline?: LeadPipelineFilter;
  period?: AnalyticsPeriodKey;
};

export type InboxQueueCounts = Record<InboxQueueFilter, number>;

const REPLY_SENDERS = new Set<ConversationSender>(["agent", "ai"]);

/** True when the latest client message has no agent/AI reply after it. */
export function leadNeedsAttentionFromConversations(
  conversations: ConversationAttentionMessage[]
): boolean {
  if (conversations.length === 0) {
    return false;
  }

  const sorted = [...conversations].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  let latestClientAt: string | null = null;
  for (const message of sorted) {
    if (message.sender === "client") {
      latestClientAt = message.created_at;
    }
  }

  if (latestClientAt === null) {
    return false;
  }

  for (const message of sorted) {
    if (
      REPLY_SENDERS.has(message.sender) &&
      message.created_at > latestClientAt
    ) {
      return false;
    }
  }

  return true;
}

export function isUnreadInboxLead(lead: Pick<LeadForInbox, "unread_count">): boolean {
  return lead.unread_count > 0;
}

export function filterLeadsByUnread<T extends LeadForInbox>(leads: T[]): T[] {
  return leads.filter(isUnreadInboxLead);
}

export function filterLeadsByNeedsAttention<T extends LeadForInbox>(
  leads: T[]
): T[] {
  return leads.filter((lead) => lead.needs_attention);
}

export function filterLeadsByInboxQueue<T extends LeadForInbox>(
  leads: T[],
  queueFilter: InboxQueueFilter,
  currentUserId: string
): T[] {
  switch (queueFilter) {
    case "unread":
      return filterLeadsByUnread(leads);
    case "needs_attention":
      return filterLeadsByNeedsAttention(leads);
    case "me":
      return leads.filter((lead) => lead.assigned_user_id === currentUserId);
    case "unassigned":
      return leads.filter((lead) => lead.assigned_user_id == null);
    default:
      return leads;
  }
}

export function buildInboxPipelineScope<T extends LeadForInbox>(
  leads: T[],
  input: InboxPipelineScopeInput
): T[] {
  let result = filterLeadsByPipeline(leads, input.pipeline);

  if (input.period) {
    result = result.filter((lead) =>
      isTimestampInAnalyticsPeriod(lead.created_at, input.period!)
    );
  }

  return result;
}

export function countNeedsAttentionLeads(
  leads: Pick<LeadForInbox, "needs_attention">[]
): number {
  return leads.filter((lead) => lead.needs_attention).length;
}

export function countUnreadLeads(
  leads: Pick<LeadForInbox, "unread_count">[]
): number {
  return leads.filter(isUnreadInboxLead).length;
}

export function computeInboxQueueCounts(
  leads: LeadForInbox[],
  input: InboxPipelineScopeInput & { currentUserId: string }
): InboxQueueCounts {
  const scoped = buildInboxPipelineScope(leads, input);

  return {
    all: scoped.length,
    unread: countUnreadLeads(scoped),
    needs_attention: countNeedsAttentionLeads(scoped),
    me: filterLeadsByInboxQueue(scoped, "me", input.currentUserId).length,
    unassigned: filterLeadsByInboxQueue(scoped, "unassigned", input.currentUserId)
      .length,
  };
}

export function parseInboxQueueFilterParam(
  value: string | undefined
): InboxQueueFilter | undefined {
  if (
    value === "all" ||
    value === "me" ||
    value === "unassigned" ||
    value === "unread" ||
    value === "needs_attention"
  ) {
    return value;
  }

  return undefined;
}

export function formatNavLeadsLabel(
  needsAttentionCount: number,
  label = "Leads"
): string {
  if (needsAttentionCount <= 0) {
    return label;
  }

  return `${label} (${needsAttentionCount})`;
}
