import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function createFollowUp(
  supabase: Client,
  followUp: FollowUpInsert
): Promise<FollowUp> {
  const { data, error } = await supabase
    .from("follow_ups")
    .insert(followUp)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create follow-up: ${error.message}`);
  }

  return data;
}

export async function cancelPendingFollowUpsForLead(
  supabase: Client,
  leadId: string,
  types?: FollowUpType[]
): Promise<number> {
  let query = supabase
    .from("follow_ups")
    .update({ status: "cancelled" })
    .eq("lead_id", leadId)
    .eq("status", "pending");

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
  leadId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("follow_ups")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("status", "sent");

  if (error) {
    throw new Error(`Failed to count follow-ups: ${error.message}`);
  }

  return count ?? 0;
}

export async function getLastSentFollowUpAt(
  supabase: Client,
  leadId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("sent_at")
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch last follow-up: ${error.message}`);
  }

  return data?.[0]?.sent_at ?? null;
}

export async function getPendingFollowUpByType(
  supabase: Client,
  leadId: string,
  type: FollowUpType
): Promise<FollowUp | null> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("lead_id", leadId)
    .eq("type", type)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch pending follow-up: ${error.message}`);
  }

  return data?.[0] ?? null;
}

export async function getDueFollowUps(
  supabase: Client,
  limit = 20
): Promise<FollowUpWithLead[]> {
  return getPendingFollowUps(supabase, limit, { dueOnly: true });
}

export async function getPendingFollowUps(
  supabase: Client,
  limit = 20,
  options: { dueOnly?: boolean } = {}
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
        user_id
      )
    `
    )
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (dueOnly) {
    query = query.lte("scheduled_for", now);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch pending follow-ups: ${error.message}`);
  }

  return (data ?? []) as FollowUpWithLead[];
}

export async function getFollowUpsForUser(
  supabase: Client,
  userId: string,
  limit = 50
): Promise<FollowUpWithLead[]> {
  const { data, error } = await supabase
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
        user_id
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch follow-ups: ${error.message}`);
  }

  return (data ?? []) as FollowUpWithLead[];
}

export async function getFollowUpById(
  supabase: Client,
  userId: string,
  followUpId: string
): Promise<FollowUpWithLead | null> {
  const { data, error } = await supabase
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
        user_id
      )
    `
    )
    .eq("id", followUpId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch follow-up: ${error.message}`);
  }

  return (data as FollowUpWithLead | null) ?? null;
}

export async function countPendingFollowUps(
  supabase: Client,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("follow_ups")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");

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
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("follow_ups")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("sent_at", startOfTodayIso());

  if (error) {
    throw new Error(`Failed to count sent follow-ups: ${error.message}`);
  }

  return count ?? 0;
}

export async function getFollowUpsGrouped(
  supabase: Client,
  userId: string,
  limit = 100
): Promise<FollowUpBuckets> {
  const followUps = await getFollowUpsForUser(supabase, userId, limit);

  return {
    pending: followUps.filter((item) => item.status === "pending"),
    sent: followUps.filter((item) => item.status === "sent"),
    failed: followUps.filter((item) => item.status === "failed"),
  };
}

export async function updateFollowUpStatus(
  supabase: Client,
  followUpId: string,
  status: FollowUpStatus,
  fields?: {
    message?: string;
    sent_at?: string | null;
    context_snapshot?: FollowUpContextSnapshot | null;
  }
): Promise<FollowUp> {
  const { data, error } = await supabase
    .from("follow_ups")
    .update({
      status,
      ...fields,
    })
    .eq("id", followUpId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update follow-up: ${error.message}`);
  }

  return data;
}

export async function getFollowUpBuckets(
  supabase: Client,
  userId: string
): Promise<FollowUpBuckets> {
  const followUps = await getFollowUpsForUser(supabase, userId, 40);

  return {
    pending: followUps.filter((item) => item.status === "pending").slice(0, 8),
    sent: followUps.filter((item) => item.status === "sent").slice(0, 8),
    failed: followUps.filter((item) => item.status === "failed").slice(0, 8),
  };
}
