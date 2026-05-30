import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  ConversationInsert,
  ConversationWithLead,
  Database,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export async function getConversationsByLead(
  supabase: Client,
  workspaceId: string,
  leadId: string
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("lead_id", leadId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  return data ?? [];
}

export async function getRecentConversationsByLead(
  supabase: Client,
  workspaceId: string,
  leadId: string,
  limit = 10
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("lead_id", leadId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent conversations: ${error.message}`);
  }

  return (data ?? []).reverse();
}

export async function createConversation(
  supabase: Client,
  conversation: ConversationInsert
): Promise<Conversation> {
  let workspaceId = conversation.workspace_id ?? null;

  if (!workspaceId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("workspace_id")
      .eq("id", conversation.lead_id)
      .maybeSingle();

    workspaceId = lead?.workspace_id ?? null;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      ...conversation,
      workspace_id: workspaceId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data;
}

export async function deleteConversationsByLeadId(
  supabase: Client,
  workspaceId: string,
  leadId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("lead_id", leadId)
    .eq("workspace_id", workspaceId)
    .select("id");

  if (error) {
    throw new Error(`Failed to delete conversations: ${error.message}`);
  }

  return data?.length ?? 0;
}

export async function getRecentConversationsForWorkspace(
  supabase: Client,
  workspaceId: string,
  limit = 10
): Promise<ConversationWithLead[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      lead_id,
      message,
      sender,
      created_at,
      leads!inner (
        id,
        client_name,
        interest,
        status,
        user_id,
        preferred_language,
        workspace_id
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent conversations: ${error.message}`);
  }

  return (data ?? []) as unknown as ConversationWithLead[];
}

/** @deprecated Use getRecentConversationsForWorkspace */
export const getRecentConversationsForUser = getRecentConversationsForWorkspace;

export async function countRecentConversations(
  supabase: Client,
  workspaceId: string,
  days = 7
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { count, error } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", since.toISOString());

  if (error) {
    throw new Error(`Failed to count conversations: ${error.message}`);
  }

  return count ?? 0;
}
