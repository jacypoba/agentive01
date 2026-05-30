import { getShownPropertyIds } from "@/lib/properties/property-cards";
import { getPropertyById } from "@/lib/data/properties";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  Database,
  FollowUpContextSnapshot,
  Lead,
  Property,
  VisitRequest,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export async function buildFollowUpContext(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  options?: {
    visit?: VisitRequest | null;
    newProperty?: Property | null;
  }
): Promise<FollowUpContextSnapshot> {
  const shownIds = [...getShownPropertyIds(history)];
  const shownTitles: string[] = [];

  for (const propertyId of shownIds.slice(-4)) {
    const property = await getPropertyById(
      supabase,
      requireLeadWorkspaceId(lead),
      propertyId
    );
    if (property?.title) {
      shownTitles.push(property.title);
    }
  }

  return {
    city: lead.preferred_area ?? options?.newProperty?.city ?? null,
    budget: lead.budget ?? null,
    property_type: lead.property_type ?? options?.newProperty?.property_type ?? null,
    lead_status: lead.status,
    intent_status: lead.intent_status ?? null,
    shown_property_titles: shownTitles,
    visit_status: options?.visit?.status ?? null,
    property_title: options?.visit?.property_title ?? shownTitles.at(-1) ?? null,
    new_property_title: options?.newProperty?.title ?? null,
    client_name: lead.client_name,
    preferred_language: lead.preferred_language,
  };
}

export function buildFollowUpContextSummary(
  context: FollowUpContextSnapshot
): string {
  const parts: string[] = [];

  if (context.client_name) {
    parts.push(`Client: ${context.client_name}`);
  }
  if (context.city) {
    parts.push(`Area: ${context.city}`);
  }
  if (context.budget) {
    parts.push(`Budget: ${context.budget}`);
  }
  if (context.property_type) {
    parts.push(`Property type: ${context.property_type}`);
  }
  if (context.property_title) {
    parts.push(`Property: ${context.property_title}`);
  }
  if (context.new_property_title) {
    parts.push(`New match: ${context.new_property_title}`);
  }
  if (context.shown_property_titles?.length) {
    parts.push(`Shown listings: ${context.shown_property_titles.join(", ")}`);
  }
  if (context.visit_status) {
    parts.push(`Visit status: ${context.visit_status}`);
  }

  return parts.length > 0 ? parts.join("; ") : "General re-engagement";
}
