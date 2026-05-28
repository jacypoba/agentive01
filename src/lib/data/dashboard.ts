import type { SupabaseClient } from "@supabase/supabase-js";
import { countLeads, countLeadsByStatus, getRecentLeads } from "@/lib/data/leads";
import { getProfile } from "@/lib/data/profiles";
import {
  countRecentConversations,
  getRecentConversationsForUser,
} from "@/lib/data/conversations";
import {
  countVisitRequestsByStatus,
  getCalendarVisitBuckets,
  getRecentVisitRequests,
} from "@/lib/data/visit-requests";
import { getFollowUpBuckets } from "@/lib/data/follow-ups";
import { getStatusBadgeColor } from "@/lib/leads/status";
import type {
  CalendarVisitBuckets,
  DashboardStats,
  Database,
  FollowUpBuckets,
  Lead,
  Profile,
  RecentActivity,
  VisitRequestWithLead,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export type DashboardData = {
  profile: Profile | null;
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  recentVisitRequests: VisitRequestWithLead[];
  calendarBuckets: CalendarVisitBuckets;
  followUpBuckets: FollowUpBuckets;
};

function formatActivityDescription(
  sender: RecentActivity["sender"],
  status: RecentActivity["status"]
): string {
  switch (sender) {
    case "client":
      return "New message from client";
    case "ai":
      return `AI handled · ${status.replace("_", " ")}`;
    case "agent":
      return "Agent replied";
    default:
      return "Activity logged";
  }
}

function mapConversationToActivity(
  conversations: Awaited<ReturnType<typeof getRecentConversationsForUser>>
): RecentActivity[] {
  return conversations.map((item) => ({
    id: item.id,
    lead_id: item.lead_id,
    message: item.message,
    sender: item.sender,
    created_at: item.created_at,
    client_name: item.leads.client_name,
    interest: item.leads.interest,
    status: item.leads.status,
    kind: "conversation" as const,
  }));
}

function mapLeadToActivity(lead: Lead): RecentActivity {
  return {
    id: lead.id,
    lead_id: lead.id,
    message: lead.interest ?? "New lead captured",
    sender: "client",
    created_at: lead.created_at,
    client_name: lead.client_name,
    interest: lead.interest,
    status: lead.status,
    kind: "lead",
  };
}

function mergeRecentActivity(
  conversations: RecentActivity[],
  leads: Lead[],
  limit = 5
): RecentActivity[] {
  const byLead = new Map<string, RecentActivity>();

  for (const item of [...conversations, ...leads.map(mapLeadToActivity)]) {
    const existing = byLead.get(item.lead_id);
    if (
      !existing ||
      new Date(item.created_at).getTime() > new Date(existing.created_at).getTime()
    ) {
      byLead.set(item.lead_id, item);
    }
  }

  return Array.from(byLead.values())
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}

export async function getDashboardData(
  supabase: Client,
  userId: string
): Promise<DashboardData> {
  const [
    profile,
    totalLeads,
    qualifiedLeads,
    scheduledLeads,
    recentConversations,
    pendingVisitRequests,
    conversations,
    leads,
    recentVisitRequests,
    calendarBuckets,
    followUpBuckets,
  ] = await Promise.all([
    getProfile(supabase, userId),
    countLeads(supabase, userId),
    countLeadsByStatus(supabase, userId, "qualified"),
    countLeadsByStatus(supabase, userId, "scheduled"),
    countRecentConversations(supabase, userId, 7),
    countVisitRequestsByStatus(supabase, userId, "pending"),
    getRecentConversationsForUser(supabase, userId, 5),
    getRecentLeads(supabase, userId, 5),
    getRecentVisitRequests(supabase, userId, 5),
    getCalendarVisitBuckets(supabase, userId),
    getFollowUpBuckets(supabase, userId),
  ]);

  return {
    profile,
    stats: {
      totalLeads,
      qualifiedLeads,
      scheduledLeads,
      recentConversations,
      pendingVisitRequests,
    },
    recentActivity: mergeRecentActivity(
      mapConversationToActivity(conversations),
      leads
    ),
    recentVisitRequests,
    calendarBuckets,
    followUpBuckets,
  };
}

export function getActivityLabel(activity: RecentActivity): string {
  if (activity.kind === "lead") {
    return "New lead captured";
  }
  return formatActivityDescription(activity.sender, activity.status);
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export { getStatusBadgeColor };
