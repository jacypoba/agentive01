import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Lead,
  LeadConversationRead,
  LeadForInbox,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export type ClientMessageTimestamp = {
  lead_id: string;
  created_at: string;
};

function workspaceFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  workspaceId: string
): T {
  return query.eq("workspace_id", workspaceId);
}

/** Sort leads for inbox: last_message_at desc nulls last, then created_at desc. */
export function compareLeadsForInbox(
  a: Pick<Lead, "last_message_at" | "created_at">,
  b: Pick<Lead, "last_message_at" | "created_at">
): number {
  const aLast = a.last_message_at;
  const bLast = b.last_message_at;

  if (aLast && bLast) {
    const byMessage = bLast.localeCompare(aLast);
    if (byMessage !== 0) {
      return byMessage;
    }
  } else if (aLast && !bLast) {
    return -1;
  } else if (!aLast && bLast) {
    return 1;
  }

  return b.created_at.localeCompare(a.created_at);
}

export function sortLeadsForInbox<T extends Pick<Lead, "last_message_at" | "created_at">>(
  leads: T[]
): T[] {
  return [...leads].sort(compareLeadsForInbox);
}

/**
 * Count unread client messages for a lead.
 * When lastReadAt is null/undefined, every client message counts as unread.
 */
export function countUnreadClientMessages(
  clientMessages: Array<{ created_at: string }>,
  lastReadAt: string | null | undefined
): number {
  if (lastReadAt == null) {
    return clientMessages.length;
  }

  return clientMessages.filter(
    (message) => message.created_at > lastReadAt
  ).length;
}

export function buildReadsByLeadIdMap(
  reads: Pick<LeadConversationRead, "lead_id" | "last_read_at">[]
): Map<string, string> {
  return new Map(reads.map((read) => [read.lead_id, read.last_read_at]));
}

export function groupClientMessagesByLeadId(
  clientMessages: ClientMessageTimestamp[]
): Map<string, Array<{ created_at: string }>> {
  const grouped = new Map<string, Array<{ created_at: string }>>();

  for (const message of clientMessages) {
    const existing = grouped.get(message.lead_id);
    if (existing) {
      existing.push({ created_at: message.created_at });
    } else {
      grouped.set(message.lead_id, [{ created_at: message.created_at }]);
    }
  }

  return grouped;
}

export function buildLeadInboxItems(
  leads: Lead[],
  readsByLeadId: Map<string, string>,
  clientMessagesByLeadId: Map<string, Array<{ created_at: string }>>
): LeadForInbox[] {
  return leads.map((lead) => {
    const clientMessages = clientMessagesByLeadId.get(lead.id) ?? [];
    const lastReadAt = readsByLeadId.get(lead.id);

    return {
      ...lead,
      unread_count: countUnreadClientMessages(clientMessages, lastReadAt),
    };
  });
}

export async function getLeadsForInbox(
  supabase: Client,
  workspaceId: string,
  userId: string
): Promise<LeadForInbox[]> {
  const [leadsResult, readsResult, messagesResult] = await Promise.all([
    workspaceFilter(supabase.from("leads").select("*"), workspaceId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_conversation_reads")
      .select("lead_id, last_read_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId),
    supabase
      .from("conversations")
      .select("lead_id, created_at")
      .eq("workspace_id", workspaceId)
      .eq("sender", "client"),
  ]);

  if (leadsResult.error) {
    throw new Error(`Failed to fetch leads for inbox: ${leadsResult.error.message}`);
  }

  if (readsResult.error) {
    throw new Error(
      `Failed to fetch conversation reads: ${readsResult.error.message}`
    );
  }

  if (messagesResult.error) {
    throw new Error(
      `Failed to fetch client messages for inbox: ${messagesResult.error.message}`
    );
  }

  const leads = leadsResult.data ?? [];
  const readsByLeadId = buildReadsByLeadIdMap(readsResult.data ?? []);
  const clientMessagesByLeadId = groupClientMessagesByLeadId(
    messagesResult.data ?? []
  );

  return buildLeadInboxItems(leads, readsByLeadId, clientMessagesByLeadId);
}

export async function markLeadConversationRead(
  supabase: Client,
  workspaceId: string,
  leadId: string,
  userId: string,
  readAt: string = new Date().toISOString()
): Promise<LeadConversationRead> {
  const { data, error } = await supabase
    .from("lead_conversation_reads")
    .upsert(
      {
        workspace_id: workspaceId,
        lead_id: leadId,
        user_id: userId,
        last_read_at: readAt,
        updated_at: readAt,
      },
      { onConflict: "lead_id,user_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to mark conversation read: ${error.message}`);
  }

  return data;
}
