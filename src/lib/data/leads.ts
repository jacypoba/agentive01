import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead, LeadInsert, LeadStatus } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function getLeads(
  supabase: Client,
  userId: string
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch leads: ${error.message}`);
  }

  return data ?? [];
}

export async function getLeadById(
  supabase: Client,
  userId: string,
  leadId: string
): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lead: ${error.message}`);
  }

  return data;
}

export async function createLead(
  supabase: Client,
  lead: LeadInsert
): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .insert(lead)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  return data;
}

export async function updateLeadStatus(
  supabase: Client,
  userId: string,
  leadId: string,
  status: LeadStatus
): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update lead: ${error.message}`);
  }

  return data;
}

export async function countLeadsByStatus(
  supabase: Client,
  userId: string,
  status: LeadStatus
): Promise<number> {
  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", status);

  if (error) {
    throw new Error(`Failed to count leads: ${error.message}`);
  }

  return count ?? 0;
}

export async function countLeads(supabase: Client, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to count leads: ${error.message}`);
  }

  return count ?? 0;
}

export async function getRecentLeads(
  supabase: Client,
  userId: string,
  limit = 5
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent leads: ${error.message}`);
  }

  return data ?? [];
}
