import { extractLeadQualification } from "@/lib/ai/extract-qualification";
import { updateLeadQualification } from "@/lib/data/leads";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Database, Lead, LeadStatus } from "@/types/database";

type Client = SupabaseClient<Database>;

const STATUS_RANK: Record<LeadStatus, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  scheduled: 3,
  closed: 4,
  lost: -1,
};

function pickHigherStatus(current: LeadStatus, next: LeadStatus): LeadStatus {
  if (STATUS_RANK[next] > STATUS_RANK[current]) {
    return next;
  }
  return current;
}

function derivePipelineStatus(
  lead: Lead,
  extracted: Awaited<ReturnType<typeof extractLeadQualification>>
): LeadStatus {
  if (extracted.visit_requested) {
    return pickHigherStatus(lead.status, "scheduled");
  }

  const filledCount = [
    extracted.budget ?? lead.budget,
    extracted.preferred_area ?? lead.preferred_area,
    extracted.property_type ?? lead.property_type,
    extracted.timeline ?? lead.timeline,
  ].filter(Boolean).length;

  if (filledCount >= 3) {
    return pickHigherStatus(lead.status, "qualified");
  }

  if (filledCount >= 1) {
    return pickHigherStatus(lead.status, "contacted");
  }

  return lead.status;
}

function mergeQualification(
  lead: Lead,
  extracted: Awaited<ReturnType<typeof extractLeadQualification>>
) {
  return {
    budget: extracted.budget ?? lead.budget,
    preferred_area: extracted.preferred_area ?? lead.preferred_area,
    property_type: extracted.property_type ?? lead.property_type,
    timeline: extracted.timeline ?? lead.timeline,
    intent_status: extracted.intent_status ?? lead.intent_status ?? "unknown",
    visit_requested: extracted.visit_requested || lead.visit_requested,
    visit_datetime_text:
      extracted.visit_datetime_text ?? lead.visit_datetime_text,
    status: derivePipelineStatus(lead, extracted),
  };
}

/**
 * Extracts qualification from conversation and persists to leads table.
 * Failures are logged but never thrown — safe for webhook flow.
 */
export async function extractAndApplyLeadQualification(
  supabase: Client,
  lead: Lead,
  history: Conversation[]
): Promise<Lead> {
  try {
    const extracted = await extractLeadQualification(lead, history);
    const merged = mergeQualification(lead, extracted);

    const updated = await updateLeadQualification(supabase, lead.id, merged);

    console.log("[Qualification] Lead updated", {
      leadId: lead.id,
      budget: updated.budget,
      preferred_area: updated.preferred_area,
      property_type: updated.property_type,
      timeline: updated.timeline,
      intent_status: updated.intent_status,
      visit_requested: updated.visit_requested,
      status: updated.status,
    });

    return updated;
  } catch (error) {
    console.error("[Qualification] Extraction failed", {
      leadId: lead.id,
      error: error instanceof Error ? error.message : error,
    });
    return lead;
  }
}
