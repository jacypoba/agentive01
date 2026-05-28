import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile, ProfileUpdate } from "@/types/database";
import { DEFAULT_CALENDAR_SETTINGS } from "@/lib/google-calendar/config";

type Client = SupabaseClient<Database>;

export async function getProfile(
  supabase: Client,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data as Profile | null;
}

export async function updateProfile(
  supabase: Client,
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data as Profile;
}

export function isGoogleCalendarConnected(profile: Profile | null): boolean {
  return Boolean(profile?.google_refresh_token);
}

export function getCalendarSettingsFromProfile(profile: Profile | null) {
  return {
    googleCalendarId:
      profile?.google_calendar_id ?? DEFAULT_CALENDAR_SETTINGS.googleCalendarId,
    workStart:
      profile?.calendar_work_start ?? DEFAULT_CALENDAR_SETTINGS.workStart,
    workEnd: profile?.calendar_work_end ?? DEFAULT_CALENDAR_SETTINGS.workEnd,
    visitDurationMinutes:
      profile?.calendar_visit_duration_minutes ??
      DEFAULT_CALENDAR_SETTINGS.visitDurationMinutes,
    connected: isGoogleCalendarConnected(profile),
    connectedAt: profile?.google_calendar_connected_at ?? null,
  };
}

export async function saveGoogleTokens(
  supabase: Client,
  userId: string,
  tokens: {
    refresh_token?: string | null;
    access_token?: string | null;
    expiry_date?: number | null;
  }
): Promise<Profile> {
  const updates: ProfileUpdate = {
    google_calendar_connected_at: new Date().toISOString(),
  };

  if (tokens.refresh_token) {
    updates.google_refresh_token = tokens.refresh_token;
  }
  if (tokens.access_token) {
    updates.google_access_token = tokens.access_token;
  }
  if (tokens.expiry_date) {
    updates.google_token_expires_at = new Date(tokens.expiry_date).toISOString();
  }

  return updateProfile(supabase, userId, updates);
}

export async function disconnectGoogleCalendar(
  supabase: Client,
  userId: string
): Promise<Profile> {
  return updateProfile(supabase, userId, {
    google_refresh_token: null,
    google_access_token: null,
    google_token_expires_at: null,
    google_calendar_connected_at: null,
  });
}

export async function updateCalendarSettings(
  supabase: Client,
  userId: string,
  settings: {
    googleCalendarId?: string;
    workStart?: string;
    workEnd?: string;
    visitDurationMinutes?: number;
  }
): Promise<Profile> {
  return updateProfile(supabase, userId, {
    google_calendar_id: settings.googleCalendarId,
    calendar_work_start: settings.workStart,
    calendar_work_end: settings.workEnd,
    calendar_visit_duration_minutes: settings.visitDurationMinutes,
  });
}
