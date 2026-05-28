import { createConversation } from "@/lib/data/conversations";
import { updateFollowUpStatus } from "@/lib/data/follow-ups";
import { getDueFollowUps } from "@/lib/data/follow-ups";
import { sendWhatsAppText } from "@/lib/evolution/client";
import { FOLLOW_UP_CONFIG } from "@/lib/follow-ups/config";
import { generateFollowUpMessage } from "@/lib/follow-ups/messages";
import { resolveLeadPhoneDigits } from "@/lib/visits/whatsapp-notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FollowUpContextSnapshot } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ProcessFollowUpsResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

function isEligibleLead(status: string, intentStatus: string | null): boolean {
  if (status === "closed" || status === "lost") {
    return false;
  }
  if (intentStatus === "not_interested") {
    return false;
  }
  return true;
}

export async function sendFollowUpImmediately(
  supabase: Client,
  followUpId: string
): Promise<{ sent: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select(
      `
      *,
      leads!inner (
        id,
        client_name,
        phone,
        phone_normalized,
        status,
        intent_status,
        preferred_area,
        property_type,
        budget,
        user_id
      )
    `
    )
    .eq("id", followUpId)
    .eq("status", "pending")
    .maybeSingle();

  if (error || !data) {
    return { sent: false, error: error?.message ?? "Follow-up not found." };
  }

  const item = data as import("@/types/database").FollowUpWithLead;
  const lead = item.leads;

  if (!isEligibleLead(lead.status, lead.intent_status)) {
    await updateFollowUpStatus(supabase, item.id, "cancelled");
    return { sent: false, error: "Lead is not eligible for follow-up." };
  }

  const phoneDigits = resolveLeadPhoneDigits(lead);
  if (!phoneDigits) {
    await updateFollowUpStatus(supabase, item.id, "failed");
    return { sent: false, error: "Lead has no phone number." };
  }

  const context = (item.context_snapshot ?? {}) as FollowUpContextSnapshot;
  const message =
    item.message?.trim() ||
    generateFollowUpMessage(item.type, context, item.id);

  try {
    await sendWhatsAppText(phoneDigits, message);
    await createConversation(supabase, {
      lead_id: item.lead_id,
      message,
      sender: "ai",
    });
    await updateFollowUpStatus(supabase, item.id, "sent", {
      message,
      sent_at: new Date().toISOString(),
    });
    return { sent: true };
  } catch (sendError) {
    await updateFollowUpStatus(supabase, item.id, "failed", { message });
    return {
      sent: false,
      error:
        sendError instanceof Error ? sendError.message : "WhatsApp send failed.",
    };
  }
}

export async function processDueFollowUps(
  supabase: Client
): Promise<ProcessFollowUpsResult> {
  const due = await getDueFollowUps(supabase, FOLLOW_UP_CONFIG.batchSize);
  const result: ProcessFollowUpsResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const item of due) {
    result.processed += 1;
    const lead = item.leads;

    if (!isEligibleLead(lead.status, lead.intent_status)) {
      await updateFollowUpStatus(supabase, item.id, "cancelled");
      result.skipped += 1;
      continue;
    }

    const phoneDigits = resolveLeadPhoneDigits(lead);
    if (!phoneDigits) {
      await updateFollowUpStatus(supabase, item.id, "failed");
      result.failed += 1;
      continue;
    }

    const context = (item.context_snapshot ?? {}) as FollowUpContextSnapshot;
    const message =
      item.message?.trim() ||
      generateFollowUpMessage(item.type, context, item.id);

    try {
      await sendWhatsAppText(phoneDigits, message);
      await createConversation(supabase, {
        lead_id: item.lead_id,
        message,
        sender: "ai",
      });
      await updateFollowUpStatus(supabase, item.id, "sent", {
        message,
        sent_at: new Date().toISOString(),
      });
      result.sent += 1;
      console.log("[Follow-ups] Sent", {
        followUpId: item.id,
        leadId: item.lead_id,
        type: item.type,
      });
    } catch (error) {
      await updateFollowUpStatus(supabase, item.id, "failed", { message });
      result.failed += 1;
      console.error("[Follow-ups] Send failed", {
        followUpId: item.id,
        leadId: item.lead_id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return result;
}
