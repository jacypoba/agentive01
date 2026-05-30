import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveWorkspaceIdForInsert } from "@/lib/workspaces/resolve-workspace-id-for-insert";
import type {
  Database,
  FollowUp,
  FollowUpBuckets,
  FollowUpContextSnapshot,
  FollowUpInsert,
  FollowUpStatus,
  FollowUpType,
  FollowUpWithLead,
} from "@/types/database";

type Client = SupabaseClient<Database>;

function workspaceFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  workspaceId: string
): T {
  return query.eq("workspace_id", workspaceId);
}

export async function createFollowUp(
  supabase: Client,
  followUp: FollowUpInsert
): Promise<FollowUp> {
  const workspaceId = await resolveWorkspaceIdForInsert(supabase, {
    userId: followUp.user_id,
    workspaceId: followUp.workspace_id,
    leadId: followUp.lead_id,
  });

  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      ...followUp,
      workspace_id: workspaceId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create follow-up: ${error.message}`);
  }

  return data;
}

export async function cancelPendingFollowUpsForLead(
  supabase: Client,
  workspaceId: string,
  leadId: string,
  types?: FollowUpType[]
): Promise<number> {
  let query = workspaceFilter(
    supabase
      .from("follow_ups")
      .update({ status: "cancelled" })
      .eq("lead_id", leadId)
      .eq("status", "pending"),
    workspaceId
  );

  if (types?.length) {
    query = query.in("type", types);
  }

  const { data, error } = await query.select("id");

  if (error) {
    throw new Error(`Failed to cancel follow-ups: ${error.message}`);
  }

  return data?.length ?? 0;
}

export async function countSentFollowUpsForLead(
  supabase: Client,
  workspaceId: string,
  leadId: string
): Promise<number> {
  const { count, error } = await workspaceFilter(
    supabase
      .from("follow_ups")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("status", "sent"),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to count follow-ups: ${error.message}`);
  }

  return count ?? 0;
}

export async function getLastSentFollowUpAt(
  supabase: Client,
  workspaceId: string,
  leadId: string
): Promise<string | null> {
  const { data, error } = await workspaceFilter(
    supabase
      .from("follow_ups")
      .select("sent_at")
      .eq("lead_id", leadId)
      .eq("status", "sent"),
    workspaceId
  )
    .order("sent_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch last follow-up: ${error.message}`);
  }

  return data?.[0]?.sent_at ?? null;
}

export async function getPendingFollowUpByType(
  supabase: Client,
  workspaceId: string,
  leadId: string,
  type: FollowUpType
): Promise<FollowUp | null> {
  const { data, error } = await workspaceFilter(
    supabase
      .from("follow_ups")
      .select("*")
      .eq("lead_id", leadId)
      .eq("type", type)
      .eq("status", "pending"),
    workspaceId
  )
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch pending follow-up: ${error.message}`);
  }

  return data?.[0] ?? null;
}

export async function getDueFollowUps(
  supabase: Client,
  limit = 20,
  workspaceId?: string
): Promise<FollowUpWithLead[]> {
  return getPendingFollowUps(supabase, limit, { dueOnly: true, workspaceId });
}

export async function getPendingFollowUps(
  supabase: Client,
  limit = 20,
  options: { dueOnly?: boolean; workspaceId?: string } = {}
): Promise<FollowUpWithLead[]> {
  const dueOnly = options.dueOnly ?? false;
  const now = new Date().toISOString();

  let query = supabase
    .from("follow_ups")
    .select(
      `
      *,
      leads!inner (
        id,
        client_name,
        phone,
        phone_normalized,
        status,
        intent_status,
        preferred_area,
        property_type,
        budget,
        user_id,
        preferred_language
      )
    `
    )
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (options.workspaceId) {
    query = query.eq("workspace_id", options.workspaceId);
  }

  if (dueOnly) {
    query = query.lte("scheduled_for", now);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch pending follow-ups: ${error.message}`);
  }

  return (data ?? []) as unknown as FollowUpWithLead[];
}

export async function getFollowUpsForWorkspace(
  supabase: Client,
  workspaceId: string,
  limit = 50
): Promise<FollowUpWithLead[]> {
  const { data, error } = await workspaceFilter(
    supabase.from("follow_ups").select(
      `
      *,
      leads!inner (
        id,
        client_name,
        phone,
        phone_normalized,
        status,
        intent_status,
        preferred_area,
        property_type,
        budget,
        user_id,
        preferred_language
      )
    `
    ),
    workspaceId
  )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch follow-ups: ${error.message}`);
  }

  return (data ?? []) as unknown as FollowUpWithLead[];
}

/** @deprecated Use getFollowUpsForWorkspace */
export const getFollowUpsForUser = getFollowUpsForWorkspace;

export async function getFollowUpById(
  supabase: Client,
  workspaceId: string,
  followUpId: string
): Promise<FollowUpWithLead | null> {
  const { data, error } = await workspaceFilter(
    supabase
      .from("follow_ups")
      .select(
        `
      *,
      leads!inner (
        id,
        client_name,
        phone,
        phone_normalized,
        status,
        intent_status,
        preferred_area,
        property_type,
        budget,
        user_id,
        preferred_language
      )
    `
      )
      .eq("id", followUpId),
    workspaceId
  ).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch follow-up: ${error.message}`);
  }

  return (data as unknown as FollowUpWithLead | null) ?? null;
}

export async function countPendingFollowUps(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const { count, error } = await workspaceFilter(
    supabase
      .from("follow_ups")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to count pending follow-ups: ${error.message}`);
  }

  return count ?? 0;
}

function startOfTodayIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function countSentFollowUpsToday(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const { count, error } = await workspaceFilter(
    supabase
      .from("follow_ups")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", startOfTodayIso()),
    workspaceId
  );

  if (error) {
    throw new Error(`Failed to count sent follow-ups: ${error.message}`);
  }

  return count ?? 0;
}

export async function getFollowUpsGrouped(
  supabase: Client,
  workspaceId: string,
  limit = 100
): Promise<FollowUpBuckets> {
  const followUps = await getFollowUpsForWorkspace(supabase, workspaceId, limit);

  return {
    pending: followUps.filter((item) => item.status === "pending"),
    sent: followUps.filter((item) => item.status === "sent"),
    failed: followUps.filter((item) => item.status === "failed"),
  };
}

export async function updateFollowUpStatus(
  supabase: Client,
  workspaceId: string,
  followUpId: string,
  status: FollowUpStatus,
  fields?: {
    message?: string;
    sent_at?: string | null;
    context_snapshot?: FollowUpContextSnapshot | null;
  }
): Promise<FollowUp> {
  const { data, error } = await workspaceFilter(
    supabase
      .from("follow_ups")
      .update({
        status,
        ...fields,
      })
      .eq("id", followUpId),
    workspaceId
  )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update follow-up: ${error.message}`);
  }

  return data;
}

export async function getFollowUpBuckets(
  supabase: Client,
  workspaceId: string
): Promise<FollowUpBuckets> {
  const followUps = await getFollowUpsForWorkspace(supabase, workspaceId, 40);

  return {
    pending: followUps.filter((item) => item.status === "pending").slice(0, 8),
    sent: followUps.filter((item) => item.status === "sent").slice(0, 8),
    failed: followUps.filter((item) => item.status === "failed").slice(0, 8),
  };
}
