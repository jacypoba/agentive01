import { deleteConversationsByLeadId } from "@/lib/data/conversations";
import { cancelPendingFollowUpsForLead } from "@/lib/data/follow-ups";
import { getLeadById, updateLeadQualification } from "@/lib/data/leads";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead, LeadUpdate } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ClearLeadMemoryOptions = {
  resetQualificationFields?: boolean;
};

export type ClearLeadMemoryResult = {
  conversationsDeleted: number;
  followUpsCancelled: number;
  qualificationReset: boolean;
};

const QUALIFICATION_RESET_FIELDS: LeadUpdate = {
  budget: null,
  preferred_area: null,
  property_type: null,
  timeline: null,
  intent_status: "unknown",
  visit_requested: false,
  visit_datetime_text: null,
  preferred_language: null,
};

export async function clearLeadMemory(
  supabase: Client,
  userId: string,
  leadId: string,
  options: ClearLeadMemoryOptions = {}
): Promise<ClearLeadMemoryResult> {
  const lead = await getLeadById(supabase, userId, leadId);
  if (!lead) {
    throw new Error("Lead not found.");
  }

  const conversationsDeleted = await deleteConversationsByLeadId(supabase, leadId);
  const followUpsCancelled = await cancelPendingFollowUpsForLead(
    supabase,
    leadId
  );

  let qualificationReset = false;
  if (options.resetQualificationFields) {
    await updateLeadQualification(supabase, leadId, QUALIFICATION_RESET_FIELDS);
    qualificationReset = true;
  }

  console.log("[Lead memory] Cleared", {
    leadId,
    userId,
    conversationsDeleted,
    followUpsCancelled,
    qualificationReset,
  });

  return {
    conversationsDeleted,
    followUpsCancelled,
    qualificationReset,
  };
}

export function buildClearMemorySuccessMessage(
  result: ClearLeadMemoryResult
): string {
  const parts = [
    `Cleared ${result.conversationsDeleted} conversation message${result.conversationsDeleted === 1 ? "" : "s"}.`,
  ];

  if (result.followUpsCancelled > 0) {
    parts.push(
      `Cancelled ${result.followUpsCancelled} pending follow-up${result.followUpsCancelled === 1 ? "" : "s"}.`
    );
  }

  if (result.qualificationReset) {
    parts.push("Qualification fields were reset.");
  }

  parts.push("The AI will treat the next WhatsApp message as a fresh start.");

  return parts.join(" ");
}
