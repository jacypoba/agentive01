import type { ExtractedQualification } from "@/lib/ai/extract-qualification";
import { clientWantsVisit } from "@/lib/ai/qualification";
import {
  createVisitRequest,
  getPendingVisitRequestForLead,
} from "@/lib/data/visit-requests";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Database, Lead, VisitRequest } from "@/types/database";

type Client = SupabaseClient<Database>;

function lastClientMessageWantsVisit(history: Conversation[]): boolean {
  const lastClient = [...history].reverse().find((item) => item.sender === "client");
  if (!lastClient) return false;

  return /\b(visita|visitar|ver o imóvel|agendar|marcar|conhecer|viewing|schedule|marcação)\b/i.test(
    lastClient.message
  );
}

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

  if (!lastClientMessageWantsVisit(history) && !clientWantsVisit(history)) {
    return null;
  }

  const requestedDatetimeText =
    extracted.visit_datetime_text ?? lead.visit_datetime_text ?? null;

  try {
    const existing = await getPendingVisitRequestForLead(
      supabase,
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

    const visitRequest = await createVisitRequest(supabase, {
      lead_id: lead.id,
      user_id: lead.user_id,
      requested_datetime_text: requestedDatetimeText,
      status: "pending",
      notes: "Detected via WhatsApp AI — awaiting team confirmation",
    });

    console.log("[Visit requests] Created pending visit request", {
      leadId: lead.id,
      visitRequestId: visitRequest.id,
      requestedDatetimeText,
    });

    return visitRequest;
  } catch (error) {
    console.error("[Visit requests] Failed to sync visit request", {
      leadId: lead.id,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
