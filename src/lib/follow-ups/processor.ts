import { isFollowUpsEnabledForWorkspace } from "@/lib/billing/workspace-subscription";
import { createConversation } from "@/lib/data/conversations";
import {
  getDueFollowUps,
  getPendingFollowUps,
  updateFollowUpStatus,
} from "@/lib/data/follow-ups";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { FOLLOW_UP_CONFIG } from "@/lib/follow-ups/config";
import { generateFollowUpMessageForWorkspace } from "@/lib/follow-ups/generate-workspace-follow-up";
import { normalizeLanguage } from "@/lib/i18n/types";
import { resolveLeadPhoneDigits } from "@/lib/visits/whatsapp-notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { Database, FollowUpContextSnapshot, FollowUpWithLead } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ProcessFollowUpsResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type ProcessFollowUpDetail = {
  followUpId: string;
  leadId: string;
  leadName: string;
  type: string;
  outcome: "sent" | "failed" | "skipped" | "cancelled";
  error?: string;
  messagePreview?: string;
};

export type ProcessPendingFollowUpsResult = ProcessFollowUpsResult & {
  details: ProcessFollowUpDetail[];
};

function resolveFollowUpWorkspaceId(item: FollowUpWithLead): string {
  if (item.workspace_id) {
    return item.workspace_id;
  }
  return requireLeadWorkspaceId(item.leads as import("@/types/database").Lead);
}

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
        user_id,
        preferred_language
      )
    `
    )
    .eq("id", followUpId)
    .eq("status", "pending")
    .maybeSingle();

  if (error || !data) {
    return { sent: false, error: error?.message ?? "Follow-up not found." };
  }

  const item = data as unknown as import("@/types/database").FollowUpWithLead;
  const lead = item.leads;

  if (!isEligibleLead(lead.status, lead.intent_status)) {
    await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "cancelled");
    return { sent: false, error: "Lead is not eligible for follow-up." };
  }

  const phoneDigits = resolveLeadPhoneDigits(lead);
  if (!phoneDigits) {
    await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "failed");
    return { sent: false, error: "Lead has no phone number." };
  }

  const workspaceId = resolveFollowUpWorkspaceId(item);
  const followUpsEnabled = await isFollowUpsEnabledForWorkspace(
    supabase,
    workspaceId,
    lead.user_id
  );
  if (!followUpsEnabled) {
    await updateFollowUpStatus(supabase, workspaceId, item.id, "cancelled");
    return { sent: false, error: "Follow-ups are not included in this plan." };
  }

  const context = (item.context_snapshot ?? {}) as FollowUpContextSnapshot;
  const language = normalizeLanguage(
    item.context_snapshot?.preferred_language ?? lead.preferred_language
  );
  const message =
    item.message?.trim() ||
    (await generateFollowUpMessageForWorkspace(
      supabase,
      workspaceId,
      item.type,
      context,
      item.id,
      language
    ));

  try {
    await sendWhatsAppText(phoneDigits, message);
    await createConversation(supabase, {
      lead_id: item.lead_id,
      message,
      sender: "ai",
    });
    await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "sent", {
      message,
      sent_at: new Date().toISOString(),
    });
    return { sent: true };
  } catch (sendError) {
    await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "failed", { message });
    return {
      sent: false,
      error:
        sendError instanceof Error ? sendError.message : "WhatsApp send failed.",
    };
  }
}

export async function processPendingFollowUps(
  supabase: Client,
  options: { dueOnly?: boolean; batchSize?: number } = {}
): Promise<ProcessPendingFollowUpsResult> {
  const dueOnly = options.dueOnly ?? true;
  const batchSize = options.batchSize ?? FOLLOW_UP_CONFIG.batchSize;
  const pending = dueOnly
    ? await getDueFollowUps(supabase, batchSize)
    : await getPendingFollowUps(supabase, batchSize, { dueOnly: false });

  const result: ProcessPendingFollowUpsResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (const item of pending) {
    result.processed += 1;
    const lead = item.leads;
    const workspaceId = resolveFollowUpWorkspaceId(item);

    const followUpsEnabled = await isFollowUpsEnabledForWorkspace(
      supabase,
      workspaceId,
      lead.user_id
    );
    if (!followUpsEnabled) {
      await updateFollowUpStatus(supabase, workspaceId, item.id, "cancelled");
      result.skipped += 1;
      result.details.push({
        followUpId: item.id,
        leadId: item.lead_id,
        leadName: lead.client_name,
        type: item.type,
        outcome: "skipped",
        error: "Plan does not include follow-ups",
      });
      continue;
    }

    if (!isEligibleLead(lead.status, lead.intent_status)) {
      await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "cancelled");
      result.skipped += 1;
      result.details.push({
        followUpId: item.id,
        leadId: item.lead_id,
        leadName: lead.client_name,
        type: item.type,
        outcome: "cancelled",
        error: "Lead not eligible",
      });
      continue;
    }

    const phoneDigits = resolveLeadPhoneDigits(lead);
    if (!phoneDigits) {
      await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "failed");
      result.failed += 1;
      result.details.push({
        followUpId: item.id,
        leadId: item.lead_id,
        leadName: lead.client_name,
        type: item.type,
        outcome: "failed",
        error: "Lead has no phone number",
      });
      continue;
    }

    const context = (item.context_snapshot ?? {}) as FollowUpContextSnapshot;
    const language = normalizeLanguage(
      item.context_snapshot?.preferred_language ?? lead.preferred_language
    );
    const message =
      item.message?.trim() ||
      (await generateFollowUpMessageForWorkspace(
        supabase,
        workspaceId,
        item.type,
        context,
        item.id,
        language
      ));

    try {
      await sendWhatsAppText(phoneDigits, message);
      await createConversation(supabase, {
        lead_id: item.lead_id,
        message,
        sender: "ai",
      });
      await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "sent", {
        message,
        sent_at: new Date().toISOString(),
      });
      result.sent += 1;
      result.details.push({
        followUpId: item.id,
        leadId: item.lead_id,
        leadName: lead.client_name,
        type: item.type,
        outcome: "sent",
        messagePreview: message.slice(0, 120),
      });
      console.log("[Follow-ups] Sent", {
        followUpId: item.id,
        leadId: item.lead_id,
        type: item.type,
      });
    } catch (error) {
      await updateFollowUpStatus(supabase, resolveFollowUpWorkspaceId(item), item.id, "failed", { message });
      result.failed += 1;
      const errorMessage =
        error instanceof Error ? error.message : "WhatsApp send failed";
      result.details.push({
        followUpId: item.id,
        leadId: item.lead_id,
        leadName: lead.client_name,
        type: item.type,
        outcome: "failed",
        error: errorMessage,
        messagePreview: message.slice(0, 120),
      });
      console.error("[Follow-ups] Send failed", {
        followUpId: item.id,
        leadId: item.lead_id,
        error: errorMessage,
      });
    }
  }

  return result;
}

export async function processDueFollowUps(
  supabase: Client
): Promise<ProcessFollowUpsResult> {
  const { details: _details, ...result } = await processPendingFollowUps(
    supabase,
    { dueOnly: true }
  );
  return result;
}
