"use server";

import { revalidatePath } from "next/cache";
import { getLeadById, updateLeadStatus } from "@/lib/data/leads";
import {
  getVisitRequestById,
  updateVisitRequestStatus,
} from "@/lib/data/visit-requests";
import { sendVisitStatusWhatsApp } from "@/lib/visits/whatsapp-notifications";
import { createClient } from "@/lib/supabase/server";
import type { VisitRequestStatus } from "@/types/database";

export type UpdateVisitStatusState = {
  error?: string;
  success?: boolean;
  message?: string;
  warning?: string;
  whatsappSent?: boolean;
};

export async function updateVisitStatus(
  visitId: string,
  status: VisitRequestStatus
): Promise<UpdateVisitStatusState> {
  if (!["pending", "confirmed", "cancelled"].includes(status)) {
    return { error: "Invalid status." };
  }

  if (status === "pending") {
    return { error: "Cannot revert a visit request to pending." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  try {
    const existing = await getVisitRequestById(supabase, user.id, visitId);
    if (!existing) {
      return { error: "Visit request not found." };
    }

    if (existing.status !== "pending") {
      return { error: "This visit request has already been updated." };
    }

    const updated = await updateVisitRequestStatus(
      supabase,
      user.id,
      visitId,
      status
    );

    if (status === "confirmed") {
      await updateLeadStatus(supabase, user.id, updated.lead_id, "scheduled");
    }

    const lead = await getLeadById(supabase, user.id, updated.lead_id);
    if (!lead) {
      revalidatePath("/visits");
      revalidatePath("/dashboard");
      revalidatePath(`/leads/${updated.lead_id}`);
      return {
        success: true,
        warning: "Visit updated, but the lead record could not be loaded for WhatsApp.",
        whatsappSent: false,
      };
    }

    const whatsapp = await sendVisitStatusWhatsApp(
      supabase,
      lead,
      status,
      updated.requested_datetime_text
    );

    revalidatePath("/visits");
    revalidatePath("/dashboard");
    revalidatePath(`/leads/${updated.lead_id}`);

    if (whatsapp.sent) {
      return {
        success: true,
        whatsappSent: true,
        message:
          status === "confirmed"
            ? "Visit confirmed and the client was notified on WhatsApp."
            : "Visit cancelled and the client was notified on WhatsApp.",
      };
    }

    return {
      success: true,
      whatsappSent: false,
      warning:
        whatsapp.error ??
        "Visit updated, but the WhatsApp notification could not be sent.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update visit.",
    };
  }
}
