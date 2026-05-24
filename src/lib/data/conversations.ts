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
  leadId: string
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  return data ?? [];
}

export async function createConversation(
  supabase: Client,
  conversation: ConversationInsert
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert(conversation)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data;
}

export async function getRecentConversationsForUser(
  supabase: Client,
  userId: string,
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
        user_id
      )
    `
    )
    .eq("leads.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent conversations: ${error.message}`);
  }

  return (data ?? []) as ConversationWithLead[];
}

export async function countRecentConversations(
  supabase: Client,
  userId: string,
  days = 7
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId);

  if (leadsError) {
    throw new Error(`Failed to fetch leads: ${leadsError.message}`);
  }

  if (!leads?.length) {
    return 0;
  }

  const leadIds = leads.map((lead) => lead.id);

  const { count, error } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .in("lead_id", leadIds)
    .gte("created_at", since.toISOString());

  if (error) {
    throw new Error(`Failed to count conversations: ${error.message}`);
  }

  return count ?? 0;
}
