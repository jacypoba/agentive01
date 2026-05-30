import type { ExtractedQualification } from "@/lib/ai/extract-qualification";
import { lastClientMessageMentionsVisit } from "@/lib/ai/qualification";
import { getPropertyById } from "@/lib/data/properties";
import {
  createVisitRequest,
  getPendingVisitRequestForLead,
} from "@/lib/data/visit-requests";
import { scheduleForPendingVisit } from "@/lib/follow-ups/scheduler";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import { getLastShownPropertyId } from "@/lib/properties/property-cards";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Database, Lead, VisitRequest } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Creates a pending visit request when the client expresses visit intent.
 * Never auto-confirms — status is always `pending`.
 */
export async function syncVisitRequestFromQualification(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  extracted: ExtractedQualification
): Promise<VisitRequest | null> {
  if (!extracted.visit_requested) {
    return null;
  }

  if (!lastClientMessageMentionsVisit(history)) {
    return null;
  }

  const requestedDatetimeText =
    extracted.visit_datetime_text ?? lead.visit_datetime_text ?? null;

  try {
    const workspaceId = requireLeadWorkspaceId(lead);
    const existing = await getPendingVisitRequestForLead(
      supabase,
      workspaceId,
      lead.id,
      requestedDatetimeText
    );
    if (existing) {
      console.log("[Visit requests] Pending request already exists", {
        leadId: lead.id,
        visitRequestId: existing.id,
      });
      return existing;
    }

    let propertyTitle: string | null = null;
    const lastPropertyId = getLastShownPropertyId(history);
    if (lastPropertyId) {
      const property = await getPropertyById(
        supabase,
        workspaceId,
        lastPropertyId
      );
      propertyTitle = property?.title?.trim() ?? null;
    }

    const visitRequest = await createVisitRequest(supabase, {
      lead_id: lead.id,
      user_id: lead.user_id,
      requested_datetime_text: requestedDatetimeText,
      status: "pending",
      notes: "Detected via WhatsApp AI — awaiting team confirmation",
      property_title: propertyTitle,
    });

    console.log("[Visit requests] Created pending visit request", {
      leadId: lead.id,
      visitRequestId: visitRequest.id,
      requestedDatetimeText,
    });

    await scheduleForPendingVisit(supabase, lead, history, visitRequest);

    return visitRequest;
  } catch (error) {
    console.error("[Visit requests] Failed to sync visit request", {
      leadId: lead.id,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
