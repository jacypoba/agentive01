import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatPhoneDisplay,
  normalizePhoneDigits,
} from "@/lib/phone/normalize";
import { resolveWorkspaceIdForInsert, resolveWorkspaceIdForSystemInsert } from "@/lib/workspaces/resolve-workspace-id-for-insert";
import type { Database, Lead, LeadInsert, LeadStatus, LeadUpdate } from "@/types/database";

type Client = SupabaseClient<Database>;

function workspaceFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  workspaceId: string
): T {
  return query.eq("workspace_id", workspaceId);
}

export async function getLeads(
  supabase: Client,
  workspaceId: string
): Promise<Lead[]> {
  const { data, error } = await workspaceFilter(
    supabase.from("leads").select("*"),
    workspaceId
  ).order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch leads: ${error.message}`);
  }

  return data ?? [];
}

export async function getLeadById(
  supabase: Client,
  workspaceId: string,
  leadId: string
): Promise<Lead | null> {
  const { data, error } = await workspaceFilter(
    supabase.from("leads").select("*").eq("id", leadId),
    workspaceId
  ).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lead: ${error.message}`);
  }

  return data;
}

export async function getLeadByPhone(
  supabase: Client,
  workspaceId: string,
  phoneDigits: string
): Promise<Lead | null> {
  const { data, error } = await workspaceFilter(
    supabase
      .from("leads")
      .select("*")
      .eq("phone_normalized", phoneDigits),
    workspaceId
  ).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lead by phone: ${error.message}`);
  }

  return data;
}

export async function createLead(
  supabase: Client,
  lead: LeadInsert,
  options?: { systemWorkspaceId?: string }
): Promise<Lead> {
  const phoneNormalized = lead.phone
    ? normalizePhoneDigits(lead.phone)
    : lead.phone_normalized ?? null;

  const workspaceId = options?.systemWorkspaceId
    ? await resolveWorkspaceIdForSystemInsert(supabase, {
        workspaceId: options.systemWorkspaceId,
      })
    : await resolveWorkspaceIdForInsert(supabase, {
        userId: lead.user_id,
        workspaceId: lead.workspace_id,
      });

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...lead,
      workspace_id: workspaceId,
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
  workspaceId: string,
  leadId: string,
  fields: LeadUpdate
): Promise<Lead> {
  const { data, error } = await workspaceFilter(
    supabase.from("leads").update(fields).eq("id", leadId),
    workspaceId
  )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update lead qualification: ${error.message}`);
  }

  return data;
}

export async function updateLeadStatus(
  supabase: Client,
  workspaceId: string,
  leadId: string,
  status: LeadStatus
): Promise<Lead> {
  const { data, error } = await workspaceFilter(
    supabase.from("leads").update({ status }).eq("id", leadId),
    workspaceId
  )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update lead: ${error.message}`);
  }

  return data;
}

export async function countLeadsByStatus(
  supabase: Client,
  workspaceId: string,
  status: LeadStatus
): Promise<number> {
  const { count, error } = await workspaceFilter(
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("status", status),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to count leads: ${error.message}`);
  }

  return count ?? 0;
}

export async function countLeads(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const { count, error } = await workspaceFilter(
    supabase.from("leads").select("*", { count: "exact", head: true }),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to count leads: ${error.message}`);
  }

  return count ?? 0;
}

export async function getRecentLeads(
  supabase: Client,
  workspaceId: string,
  limit = 5
): Promise<Lead[]> {
  const { data, error } = await workspaceFilter(
    supabase.from("leads").select("*"),
    workspaceId
  )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent leads: ${error.message}`);
  }

  return data ?? [];
}
