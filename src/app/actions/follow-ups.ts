"use server";

import { revalidatePath } from "next/cache";
import { getConversationsByLead } from "@/lib/data/conversations";
import { getLeadById } from "@/lib/data/leads";
import { buildFollowUpContext } from "@/lib/follow-ups/context";
import { generateFollowUpMessage } from "@/lib/follow-ups/messages";
import { sendFollowUpImmediately } from "@/lib/follow-ups/processor";
import { scheduleFollowUp } from "@/lib/follow-ups/scheduler";
import { createClient } from "@/lib/supabase/server";
import type { FollowUpType } from "@/types/database";

export type FollowUpActionState = {
  error?: string;
  success?: string;
};

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
    const message = generateFollowUpMessage(type, context, `${leadId}:manual`);

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

    revalidatePath("/dashboard");
    revalidatePath(`/leads/${leadId}`);

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
