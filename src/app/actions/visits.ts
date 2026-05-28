"use server";

import { revalidatePath } from "next/cache";
import { getLeadById, updateLeadStatus } from "@/lib/data/leads";
import {
  getCalendarSettingsFromProfile,
  getProfile,
  isGoogleCalendarConnected,
} from "@/lib/data/profiles";
import {
  getVisitRequestById,
  updateVisitRequestCalendarFields,
  updateVisitRequestStatus,
} from "@/lib/data/visit-requests";
import {
  checkVisitSlotConflict,
  createVisitCalendarEvent,
  deleteVisitCalendarEvent,
} from "@/lib/google-calendar/events";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/config";
import {
  parseRequestedVisitDatetime,
  isWithinWorkingHours,
} from "@/lib/visits/parse-datetime";
import {
  sendVisitConflictWhatsApp,
  sendVisitStatusWhatsApp,
} from "@/lib/visits/whatsapp-notifications";
import { createClient } from "@/lib/supabase/server";
import type { VisitRequestStatus } from "@/types/database";

export type UpdateVisitStatusState = {
  error?: string;
  success?: boolean;
  message?: string;
  warning?: string;
  whatsappSent?: boolean;
  suggestedSlot?: string;
  conflict?: boolean;
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

    const profile = await getProfile(supabase, user.id);
    const calendarSettings = getCalendarSettingsFromProfile(profile);
    const googleConnected =
      isGoogleCalendarConfigured() && isGoogleCalendarConnected(profile);

    let parsedSlot = parseRequestedVisitDatetime(
      existing.requested_datetime_text,
      calendarSettings.visitDurationMinutes
    );
    let naturalWhen = parsedSlot?.displayText ?? null;

    if (status === "confirmed" && googleConnected && profile) {
      if (!parsedSlot) {
        return {
          error:
            "Could not parse the requested date/time. Edit the visit request or connect a clearer slot before confirming.",
        };
      }

      if (
        !isWithinWorkingHours(
          parsedSlot,
          calendarSettings.workStart,
          calendarSettings.workEnd
        )
      ) {
        return {
          error: `The requested time is outside working hours (${calendarSettings.workStart}–${calendarSettings.workEnd}).`,
        };
      }

      const conflict = await checkVisitSlotConflict(profile, parsedSlot);
      if (!conflict.available) {
        const lead = await getLeadById(supabase, user.id, existing.lead_id);
        if (lead) {
          await sendVisitConflictWhatsApp(
            supabase,
            lead,
            conflict.suggestedText
          );
        }

        return {
          conflict: true,
          suggestedSlot: conflict.suggestedText,
          error: `That slot is already occupied on your calendar. Suggested alternative: ${conflict.suggestedText}. The client was notified on WhatsApp.`,
        };
      }
    }

    let googleEventId: string | null = null;

    if (status === "confirmed" && googleConnected && profile && parsedSlot) {
      const lead = await getLeadById(supabase, user.id, existing.lead_id);
      if (!lead) {
        return { error: "Lead not found for calendar event." };
      }

      googleEventId = await createVisitCalendarEvent(
        profile,
        existing,
        lead,
        parsedSlot
      );
    }

    const updated = await updateVisitRequestStatus(
      supabase,
      user.id,
      visitId,
      status
    );

    if (parsedSlot || googleEventId) {
      await updateVisitRequestCalendarFields(supabase, user.id, visitId, {
        scheduled_start: parsedSlot?.start.toISOString() ?? null,
        scheduled_end: parsedSlot?.end.toISOString() ?? null,
        google_calendar_event_id: googleEventId,
        property_title:
          existing.property_title ?? existing.leads.property_type ?? null,
      });
    }

    if (status === "confirmed") {
      await updateLeadStatus(supabase, user.id, updated.lead_id, "scheduled");
    }

    if (status === "cancelled" && existing.google_calendar_event_id && profile) {
      await deleteVisitCalendarEvent(
        profile,
        existing.google_calendar_event_id
      );
    }

    const lead = await getLeadById(supabase, user.id, updated.lead_id);
    if (!lead) {
      revalidatePath("/visits");
      revalidatePath("/dashboard");
      revalidatePath("/settings/calendar");
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
      updated.requested_datetime_text,
      naturalWhen
    );

    revalidatePath("/visits");
    revalidatePath("/dashboard");
    revalidatePath("/settings/calendar");
    revalidatePath(`/leads/${updated.lead_id}`);

    if (whatsapp.sent) {
      return {
        success: true,
        whatsappSent: true,
        message:
          status === "confirmed"
            ? googleEventId
              ? "Visit confirmed, added to Google Calendar, and the client was notified on WhatsApp."
              : "Visit confirmed and the client was notified on WhatsApp."
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
