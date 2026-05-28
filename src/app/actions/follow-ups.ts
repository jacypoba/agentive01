"use server";

import { revalidatePath } from "next/cache";
import { getConversationsByLead } from "@/lib/data/conversations";
import {
  getFollowUpById,
  updateFollowUpStatus,
} from "@/lib/data/follow-ups";
import { getLeadById } from "@/lib/data/leads";
import { buildFollowUpContext } from "@/lib/follow-ups/context";
import { generateFollowUpMessage } from "@/lib/follow-ups/messages";
import { sendFollowUpImmediately } from "@/lib/follow-ups/processor";
import { scheduleFollowUp } from "@/lib/follow-ups/scheduler";
import { getLeadLanguage } from "@/lib/i18n/sync-language";
import { createClient } from "@/lib/supabase/server";
import type { FollowUpType } from "@/types/database";

export type FollowUpActionState = {
  error?: string;
  success?: string;
};

function revalidateFollowUpPaths(leadId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  if (leadId) {
    revalidatePath(`/leads/${leadId}`);
  }
}

export async function sendFollowUpByIdAction(
  followUpId: string
): Promise<FollowUpActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const followUp = await getFollowUpById(supabase, user.id, followUpId);
  if (!followUp) {
    return { error: "Follow-up not found." };
  }

  if (followUp.status !== "pending" && followUp.status !== "failed") {
    return { error: "Only pending or failed follow-ups can be sent." };
  }

  if (followUp.status === "failed") {
    await updateFollowUpStatus(supabase, followUpId, "pending");
  }

  const result = await sendFollowUpImmediately(supabase, followUpId);
  revalidateFollowUpPaths(followUp.lead_id);

  if (result.sent) {
    return { success: "Follow-up sent on WhatsApp." };
  }

  return {
    error: result.error ?? "Follow-up could not be sent.",
  };
}

export async function markFollowUpSentAction(
  followUpId: string
): Promise<FollowUpActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const followUp = await getFollowUpById(supabase, user.id, followUpId);
  if (!followUp) {
    return { error: "Follow-up not found." };
  }

  if (followUp.status !== "pending" && followUp.status !== "failed") {
    return { error: "Only pending or failed follow-ups can be marked as sent." };
  }

  await updateFollowUpStatus(supabase, followUpId, "sent", {
    sent_at: new Date().toISOString(),
  });

  revalidateFollowUpPaths(followUp.lead_id);
  return { success: "Follow-up marked as sent." };
}

export async function cancelFollowUpAction(
  followUpId: string
): Promise<FollowUpActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const followUp = await getFollowUpById(supabase, user.id, followUpId);
  if (!followUp) {
    return { error: "Follow-up not found." };
  }

  if (followUp.status !== "pending") {
    return { error: "Only pending follow-ups can be cancelled." };
  }

  await updateFollowUpStatus(supabase, followUpId, "cancelled");
  revalidateFollowUpPaths(followUp.lead_id);
  return { success: "Follow-up cancelled." };
}

export async function triggerFollowUpNowAction(
  leadId: string,
  type: FollowUpType = "silent_lead"
): Promise<FollowUpActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const lead = await getLeadById(supabase, user.id, leadId);
  if (!lead) {
    return { error: "Lead not found." };
  }

  try {
    const history = await getConversationsByLead(supabase, leadId);
    const context = await buildFollowUpContext(supabase, lead, history);
    context.preferred_language = getLeadLanguage(lead);
    const message = generateFollowUpMessage(type, context, `${leadId}:manual`, getLeadLanguage(lead));

    const followUp = await scheduleFollowUp(supabase, {
      lead,
      type,
      context,
      message,
      scheduledFor: new Date(),
      replacePending: true,
      force: true,
    });

    if (!followUp) {
      return {
        error:
          "Could not schedule follow-up (cooldown, max reached, or lead inactive).",
      };
    }

    const result = await sendFollowUpImmediately(supabase, followUp.id);
    revalidateFollowUpPaths(leadId);

    if (result.sent) {
      return { success: "Follow-up sent on WhatsApp." };
    }

    return {
      error: result.error ?? "Follow-up was queued but could not be sent.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to trigger follow-up.",
    };
  }
}
