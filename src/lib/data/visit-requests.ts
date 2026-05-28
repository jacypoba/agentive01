import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveWorkspaceIdForInsert } from "@/lib/workspaces/resolve-workspace-id-for-insert";
import type {
  Database,
  VisitRequest,
  VisitRequestInsert,
  VisitRequestStatus,
  VisitRequestUpdate,
  VisitRequestWithLead,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export async function getVisitRequests(
  supabase: Client,
  userId: string
): Promise<VisitRequestWithLead[]> {
  const { data, error } = await supabase
    .from("visit_requests")
    .select(
      `
      *,
      leads!inner (
        id,
        client_name,
        phone,
        preferred_area,
        property_type,
        budget,
        status
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch visit requests: ${error.message}`);
  }

  return (data ?? []) as unknown as VisitRequestWithLead[];
}

export async function getVisitRequestById(
  supabase: Client,
  userId: string,
  visitId: string
): Promise<VisitRequestWithLead | null> {
  const { data, error } = await supabase
    .from("visit_requests")
    .select(
      `
      *,
      leads!inner (
        id,
        client_name,
        phone,
        preferred_area,
        property_type,
        budget,
        status
      )
    `
    )
    .eq("id", visitId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch visit request: ${error.message}`);
  }

  return data as unknown as VisitRequestWithLead | null;
}

export async function getRecentVisitRequests(
  supabase: Client,
  userId: string,
  limit = 5
): Promise<VisitRequestWithLead[]> {
  const { data, error } = await supabase
    .from("visit_requests")
    .select(
      `
      *,
      leads!inner (
        id,
        client_name,
        phone,
        preferred_area,
        property_type,
        budget,
        status
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent visit requests: ${error.message}`);
  }

  return (data ?? []) as unknown as VisitRequestWithLead[];
}

export async function countVisitRequestsByStatus(
  supabase: Client,
  userId: string,
  status: VisitRequestStatus
): Promise<number> {
  const { count, error } = await supabase
    .from("visit_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", status);

  if (error) {
    throw new Error(`Failed to count visit requests: ${error.message}`);
  }

  return count ?? 0;
}

export async function getPendingVisitRequestForLead(
  supabase: Client,
  leadId: string,
  requestedDatetimeText: string | null
): Promise<VisitRequest | null> {
  let query = supabase
    .from("visit_requests")
    .select("*")
    .eq("lead_id", leadId)
    .eq("status", "pending");

  if (requestedDatetimeText) {
    query = query.eq("requested_datetime_text", requestedDatetimeText);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch pending visit request: ${error.message}`);
  }

  return data;
}

export async function createVisitRequest(
  supabase: Client,
  request: VisitRequestInsert
): Promise<VisitRequest> {
  const workspaceId = await resolveWorkspaceIdForInsert(supabase, {
    userId: request.user_id,
    workspaceId: request.workspace_id,
    leadId: request.lead_id,
  });

  const { data, error } = await supabase
    .from("visit_requests")
    .insert({
      ...request,
      workspace_id: workspaceId,
      status: request.status ?? "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create visit request: ${error.message}`);
  }

  return data;
}

export async function updateVisitRequestStatus(
  supabase: Client,
  userId: string,
  visitId: string,
  status: VisitRequestStatus
): Promise<VisitRequest> {
  const { data, error } = await supabase
    .from("visit_requests")
    .update({ status })
    .eq("id", visitId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update visit request: ${error.message}`);
  }

  return data;
}

export async function getCalendarVisitBuckets(
  supabase: Client,
  userId: string
): Promise<import("@/types/database").CalendarVisitBuckets> {
  const visits = await getVisitRequests(supabase, userId);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const pending = visits.filter((visit) => visit.status === "pending");

  const confirmed = visits.filter((visit) => visit.status === "confirmed");

  const today = confirmed.filter((visit) => {
    if (!visit.scheduled_start) return false;
    const start = new Date(visit.scheduled_start);
    return start >= startOfToday && start <= endOfToday;
  });

  const upcoming = confirmed
    .filter((visit) => {
      if (!visit.scheduled_start) return false;
      return new Date(visit.scheduled_start) > endOfToday;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_start!).getTime() -
        new Date(b.scheduled_start!).getTime()
    )
    .slice(0, 8);

  return { today, upcoming, pending: pending.slice(0, 8) };
}

export async function updateVisitRequestCalendarFields(
  supabase: Client,
  userId: string,
  visitId: string,
  fields: VisitRequestUpdate
): Promise<VisitRequest> {
  const { data, error } = await supabase
    .from("visit_requests")
    .update(fields)
    .eq("id", visitId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update visit request: ${error.message}`);
  }

  return data;
}
