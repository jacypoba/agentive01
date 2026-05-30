import { getLeads } from "@/lib/data/leads";
import { getRecentConversationsByLead } from "@/lib/data/conversations";
import {
  scheduleForNewMatchingProperty,
  scheduleSilentLeadIfNeeded,
} from "@/lib/follow-ups/scheduler";
import { requireEntityWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Property } from "@/types/database";

type Client = SupabaseClient<Database>;

function leadMatchesProperty(
  lead: {
    preferred_area: string | null;
    property_type: string | null;
    budget: string | null;
    status: string;
    intent_status: string | null;
  },
  property: Property
): boolean {
  if (lead.status === "closed" || lead.status === "lost") {
    return false;
  }
  if (lead.intent_status === "not_interested") {
    return false;
  }

  const area = lead.preferred_area?.toLowerCase().trim();
  if (area) {
    const city = property.city.toLowerCase();
    const neighborhood = property.neighborhood?.toLowerCase() ?? "";
    if (!city.includes(area) && !neighborhood.includes(area) && !area.includes(city)) {
      return false;
    }
  }

  const leadType = lead.property_type?.toLowerCase().trim();
  const propertyType = property.property_type.toLowerCase();
  if (leadType && !propertyType.includes(leadType) && !leadType.includes(propertyType)) {
    return false;
  }

  return true;
}

export async function triggerFollowUpsForNewProperty(
  supabase: Client,
  workspaceId: string,
  property: Property
): Promise<number> {
  const leads = await getLeads(supabase, workspaceId);
  let scheduled = 0;

  for (const lead of leads) {
    if (!leadMatchesProperty(lead, property)) {
      continue;
    }

    const history = await getRecentConversationsByLead(
      supabase,
      workspaceId,
      lead.id,
      20
    );
    const created = await scheduleForNewMatchingProperty(
      supabase,
      lead,
      history,
      property
    );
    if (created) {
      scheduled += 1;
    }
  }

  return scheduled;
}

export async function scanSilentLeadsForFollowUp(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const leads = await getLeads(supabase, workspaceId);
  let scheduled = 0;

  for (const lead of leads) {
    if (lead.status === "closed" || lead.status === "lost") {
      continue;
    }

    const history = await getRecentConversationsByLead(
      supabase,
      workspaceId,
      lead.id,
      15
    );
    if (history.length === 0) {
      continue;
    }

    const lastClient = [...history].reverse().find((item) => item.sender === "client");
    if (!lastClient) {
      continue;
    }

    const lastMessage = history.at(-1);
    if (lastMessage?.sender === "client") {
      continue;
    }

    const created = await scheduleSilentLeadIfNeeded(
      supabase,
      lead,
      history,
      new Date(lastClient.created_at)
    );

    if (created) {
      scheduled += 1;
    }
  }

  return scheduled;
}

export function resolvePropertyWorkspaceId(property: Property): string {
  return requireEntityWorkspaceId(property, "Property");
}
