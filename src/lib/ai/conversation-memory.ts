import { getRecentConversationsByLead } from "@/lib/data/conversations";
import { getLeadById } from "@/lib/data/leads";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Database, Lead } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Number of recent messages included in AI context. */
export const MEMORY_MESSAGE_LIMIT = 10;

export type ConversationMemory = {
  lead: Lead;
  history: Conversation[];
};

/**
 * Loads fresh lead CRM fields and the last N messages before generating a reply.
 */
export async function loadConversationMemory(
  supabase: Client,
  lead: Lead,
  limit = MEMORY_MESSAGE_LIMIT
): Promise<ConversationMemory> {
  const workspaceId = requireLeadWorkspaceId(lead);
  const [freshLead, history] = await Promise.all([
    getLeadById(supabase, workspaceId, lead.id),
    getRecentConversationsByLead(supabase, workspaceId, lead.id, limit),
  ]);

  return {
    lead: freshLead ?? lead,
    history,
  };
}
