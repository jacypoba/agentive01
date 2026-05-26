import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatPhoneDisplay,
  normalizePhoneDigits,
} from "@/lib/phone/normalize";
import type { Database, Lead, LeadInsert, LeadStatus, LeadUpdate } from "@/types/database";

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

export async function getLeadByPhone(
  supabase: Client,
  userId: string,
  phoneDigits: string
): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("phone_normalized", phoneDigits)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lead by phone: ${error.message}`);
  }

  return data;
}

export async function createLead(
  supabase: Client,
  lead: LeadInsert
): Promise<Lead> {
  const phoneNormalized = lead.phone
    ? normalizePhoneDigits(lead.phone)
    : lead.phone_normalized ?? null;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...lead,
      phone: lead.phone
        ? formatPhoneDisplay(normalizePhoneDigits(lead.phone))
        : lead.phone,
      phone_normalized: phoneNormalized,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  return data;
}

export async function updateLeadQualification(
  supabase: Client,
  leadId: string,
  fields: LeadUpdate
): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .update(fields)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update lead qualification: ${error.message}`);
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
