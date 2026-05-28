"use server";

import { revalidatePath } from "next/cache";
import {
  disconnectGoogleCalendar,
  getProfile,
  updateCalendarSettings,
} from "@/lib/data/profiles";
import { listGoogleCalendars } from "@/lib/google-calendar/oauth";
import { createClient } from "@/lib/supabase/server";

export type CalendarSettingsState = {
  error?: string;
  success?: string;
};

export async function saveCalendarSettingsAction(
  _prev: CalendarSettingsState,
  formData: FormData
): Promise<CalendarSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const googleCalendarId = (formData.get("google_calendar_id") as string)?.trim();
  const workStart = (formData.get("work_start") as string)?.trim();
  const workEnd = (formData.get("work_end") as string)?.trim();
  const durationRaw = (formData.get("visit_duration_minutes") as string)?.trim();
  const duration = Number.parseInt(durationRaw, 10);

  if (!googleCalendarId || !workStart || !workEnd) {
    return { error: "Calendar, work start, and work end are required." };
  }

  if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
    return { error: "Visit duration must be between 15 and 240 minutes." };
  }

  try {
    await updateCalendarSettings(supabase, user.id, {
      googleCalendarId,
      workStart,
      workEnd,
      visitDurationMinutes: duration,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to save settings.",
    };
  }

  revalidatePath("/settings/calendar");
  revalidatePath("/dashboard");
  return { success: "Calendar settings saved." };
}

export async function disconnectGoogleCalendarAction(): Promise<CalendarSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  try {
    await disconnectGoogleCalendar(supabase, user.id);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to disconnect Google.",
    };
  }

  revalidatePath("/settings/calendar");
  revalidatePath("/dashboard");
  return { success: "Google Calendar disconnected." };
}

export async function fetchGoogleCalendarsAction(): Promise<{
  error?: string;
  calendars?: { id: string; summary: string; primary: boolean }[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile?.google_refresh_token) {
    return { error: "Connect Google Calendar first." };
  }

  try {
    const calendars = await listGoogleCalendars(profile);
    return { calendars };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to load calendars.",
    };
  }
}
