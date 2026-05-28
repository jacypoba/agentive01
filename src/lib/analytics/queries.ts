import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsDateRange } from "@/lib/analytics/types";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

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
  userId: string,
  range: AnalyticsDateRange
): Promise<LeadAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "created_at, status, preferred_language, preferred_area, property_type, visit_requested"
    )
    .eq("user_id", userId)
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch lead analytics: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllLeadRowsForFunnel(
  supabase: Client,
  userId: string
): Promise<LeadAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "created_at, status, preferred_language, preferred_area, property_type, visit_requested"
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch lead funnel data: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchVisitAnalyticsRows(
  supabase: Client,
  userId: string,
  range: AnalyticsDateRange
): Promise<VisitAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("visit_requests")
    .select("created_at, status")
    .eq("user_id", userId)
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch visit analytics: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchFollowUpAnalyticsRows(
  supabase: Client,
  userId: string,
  range: AnalyticsDateRange
): Promise<FollowUpAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("created_at, sent_at, status")
    .eq("user_id", userId)
    .gte("created_at", range.start)
    .lte("created_at", range.end);

  if (error) {
    throw new Error(`Failed to fetch follow-up analytics: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllVisitRowsForFunnel(
  supabase: Client,
  userId: string
): Promise<VisitAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("visit_requests")
    .select("created_at, status")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch visit funnel data: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchPropertyAnalyticsRows(
  supabase: Client,
  userId: string
): Promise<PropertyAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("created_at, city, property_type")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch property analytics: ${error.message}`);
  }

  return data ?? [];
}

export async function countInboundWhatsAppMessages(
  supabase: Client,
  userId: string,
  range: AnalyticsDateRange
): Promise<number> {
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId);

  if (leadsError) {
    throw new Error(`Failed to fetch leads for WhatsApp analytics: ${leadsError.message}`);
  }

  if (!leads?.length) {
    return 0;
  }

  const leadIds = leads.map((lead) => lead.id);

  const { count, error } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .in("lead_id", leadIds)
    .eq("sender", "client")
    .gte("created_at", range.start)
    .lte("created_at", range.end);

  if (error) {
    throw new Error(`Failed to count WhatsApp messages: ${error.message}`);
  }

  return count ?? 0;
}
