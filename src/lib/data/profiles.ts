import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile, ProfileInsert, ProfileUpdate } from "@/types/database";
import { DEFAULT_CALENDAR_SETTINGS } from "@/lib/google-calendar/config";

type Client = SupabaseClient<Database>;

export type ProfileSeed = Pick<ProfileInsert, "full_name" | "email">;

export function profileSeedFromAuthUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): ProfileSeed {
  return {
    full_name:
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      null,
    email: user.email ?? null,
  };
}

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
    console.error("[Profiles] Profile lookup failed", {
      userId,
      error: error.message,
    });
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  console.log("[Profiles] Profile lookup", {
    userId,
    found: Boolean(data),
    profileId: data?.id ?? null,
  });

  return data as Profile | null;
}

export async function ensureProfile(
  supabase: Client,
  userId: string,
  seed?: ProfileSeed
): Promise<Profile> {
  const existing = await getProfile(supabase, userId);
  if (existing) {
    return existing;
  }

  console.log("[Profiles] Creating missing profile row", {
    userId,
    seedEmail: seed?.email ?? null,
  });

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      full_name: seed?.full_name ?? null,
      email: seed?.email ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const recovered = await getProfile(supabase, userId);
      if (recovered) {
        console.log("[Profiles] Recovered profile after concurrent create", {
          userId,
        });
        return recovered;
      }
    }

    console.error("[Profiles] Profile create failed", {
      userId,
      error: error.message,
      code: error.code,
    });
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to create profile: insert returned no row.");
  }

  console.log("[Profiles] Profile created", { userId, profileId: data.id });
  return data as Profile;
}

export async function updateProfile(
  supabase: Client,
  userId: string,
  updates: ProfileUpdate,
  seed?: ProfileSeed
): Promise<Profile> {
  console.log("[Profiles] Updating profile", {
    userId,
    fields: Object.keys(updates),
  });

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[Profiles] Profile update failed", {
      userId,
      error: error.message,
    });
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  if (data) {
    console.log("[Profiles] Profile updated", { userId, profileId: data.id });
    return data as Profile;
  }

  console.warn("[Profiles] Profile update matched no rows — ensuring profile", {
    userId,
  });

  await ensureProfile(supabase, userId, seed);

  const { data: retryData, error: retryError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (retryError) {
    console.error("[Profiles] Profile update retry failed", {
      userId,
      error: retryError.message,
    });
    throw new Error(`Failed to update profile: ${retryError.message}`);
  }

  if (!retryData) {
    throw new Error("Failed to update profile: profile row still missing.");
  }

  console.log("[Profiles] Profile updated after ensure", {
    userId,
    profileId: retryData.id,
  });

  return retryData as Profile;
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
  },
  seed?: ProfileSeed
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

  console.log("[Profiles] Saving Google tokens", {
    userId,
    hasRefreshToken: Boolean(tokens.refresh_token),
    hasAccessToken: Boolean(tokens.access_token),
  });

  return updateProfile(supabase, userId, updates, seed);
}

export async function disconnectGoogleCalendar(
  supabase: Client,
  userId: string,
  seed?: ProfileSeed
): Promise<Profile> {
  return updateProfile(
    supabase,
    userId,
    {
      google_refresh_token: null,
      google_access_token: null,
      google_token_expires_at: null,
      google_calendar_connected_at: null,
    },
    seed
  );
}

export async function updateCalendarSettings(
  supabase: Client,
  userId: string,
  settings: {
    googleCalendarId?: string;
    workStart?: string;
    workEnd?: string;
    visitDurationMinutes?: number;
  },
  seed?: ProfileSeed
): Promise<Profile> {
  return updateProfile(
    supabase,
    userId,
    {
      google_calendar_id: settings.googleCalendarId,
      calendar_work_start: settings.workStart,
      calendar_work_end: settings.workEnd,
      calendar_visit_duration_minutes: settings.visitDurationMinutes,
    },
    seed
  );
}
