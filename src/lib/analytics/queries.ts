import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsDateRange } from "@/lib/analytics/types";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

function applyCreatedAtRange<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  range: AnalyticsDateRange
): T {
  if (range.allTime || !range.start || !range.end) {
    return query;
  }

  return query.gte("created_at", range.start).lte("created_at", range.end);
}

function applySentAtRange<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  range: AnalyticsDateRange
): T {
  if (range.allTime || !range.start || !range.end) {
    return query;
  }

  return query.gte("sent_at", range.start).lte("sent_at", range.end);
}

export type LeadAnalyticsRow = {
  created_at: string;
  status: Database["public"]["Tables"]["leads"]["Row"]["status"];
  preferred_language: string | null;
  preferred_area: string | null;
  property_type: string | null;
  visit_requested: boolean;
};

export type VisitAnalyticsRow = {
  created_at: string;
  status: Database["public"]["Tables"]["visit_requests"]["Row"]["status"];
};

export type FollowUpAnalyticsRow = {
  created_at: string;
  sent_at: string | null;
  status: Database["public"]["Tables"]["follow_ups"]["Row"]["status"];
};

export type PropertyAnalyticsRow = {
  created_at: string;
  city: string;
  property_type: string;
};

export async function fetchLeadAnalyticsRows(
  supabase: Client,
  workspaceId: string,
  range: AnalyticsDateRange
): Promise<LeadAnalyticsRow[]> {
  const { data, error } = await applyCreatedAtRange(
    supabase
      .from("leads")
      .select(
        "created_at, status, preferred_language, preferred_area, property_type, visit_requested"
      )
      .eq("workspace_id", workspaceId),
    range
  ).order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch lead analytics: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllLeadRowsForFunnel(
  supabase: Client,
  workspaceId: string
): Promise<LeadAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "created_at, status, preferred_language, preferred_area, property_type, visit_requested"
    )
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to fetch lead funnel data: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchVisitAnalyticsRows(
  supabase: Client,
  workspaceId: string,
  range: AnalyticsDateRange
): Promise<VisitAnalyticsRow[]> {
  const { data, error } = await applyCreatedAtRange(
    supabase
      .from("visit_requests")
      .select("created_at, status")
      .eq("workspace_id", workspaceId),
    range
  ).order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch visit analytics: ${error.message}`);
  }

  return data ?? [];
}

/** Sent follow-ups in period — filtered by sent_at, not created_at. */
export async function fetchSentFollowUpAnalyticsRows(
  supabase: Client,
  workspaceId: string,
  range: AnalyticsDateRange
): Promise<FollowUpAnalyticsRow[]> {
  const { data, error } = await applySentAtRange(
    supabase
      .from("follow_ups")
      .select("created_at, sent_at, status")
      .eq("workspace_id", workspaceId)
      .eq("status", "sent")
      .not("sent_at", "is", null),
    range
  ).order("sent_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch sent follow-up analytics: ${error.message}`);
  }

  return data ?? [];
}

export async function countSentFollowUpsInRange(
  supabase: Client,
  workspaceId: string,
  range: AnalyticsDateRange
): Promise<number> {
  const { count, error } = await applySentAtRange(
    supabase
      .from("follow_ups")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "sent")
      .not("sent_at", "is", null),
    range
  );

  if (error) {
    throw new Error(`Failed to count sent follow-ups: ${error.message}`);
  }

  return count ?? 0;
}

export async function fetchAllVisitRowsForFunnel(
  supabase: Client,
  workspaceId: string
): Promise<VisitAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("visit_requests")
    .select("created_at, status")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to fetch visit funnel data: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchPropertyAnalyticsRows(
  supabase: Client,
  workspaceId: string,
  range?: AnalyticsDateRange
): Promise<PropertyAnalyticsRow[]> {
  const baseQuery = supabase
    .from("properties")
    .select("created_at, city, property_type")
    .eq("workspace_id", workspaceId);

  const { data, error } = range
    ? await applyCreatedAtRange(baseQuery, range)
    : await baseQuery;

  if (error) {
    throw new Error(`Failed to fetch property analytics: ${error.message}`);
  }

  return data ?? [];
}

export async function countInboundWhatsAppMessages(
  supabase: Client,
  workspaceId: string,
  range: AnalyticsDateRange
): Promise<number> {
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id")
    .eq("workspace_id", workspaceId);

  if (leadsError) {
    throw new Error(`Failed to fetch leads for WhatsApp analytics: ${leadsError.message}`);
  }

  if (!leads?.length) {
    return 0;
  }

  const leadIds = leads.map((lead) => lead.id);

  let messageQuery = supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .in("lead_id", leadIds)
    .eq("sender", "client");

  if (!range.allTime && range.start && range.end) {
    messageQuery = messageQuery
      .gte("created_at", range.start)
      .lte("created_at", range.end);
  }

  const { count, error } = await messageQuery;

  if (error) {
    throw new Error(`Failed to count WhatsApp messages: ${error.message}`);
  }

  return count ?? 0;
}
