import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile, ProfileInsert, ProfileUpdate } from "@/types/database";
import { DEFAULT_CALENDAR_SETTINGS } from "@/lib/google-calendar/config";

type Client = SupabaseClient<Database>;

export type ProfileSeed = Pick<ProfileInsert, "full_name" | "email">;

function firstRow<T>(rows: T[] | null | undefined): T | null {
  return rows?.[0] ?? null;
}

function buildProfilePayload(
  userId: string,
  fields: ProfileUpdate,
  seed?: ProfileSeed
): ProfileInsert {
  const payload: ProfileInsert = {
    id: userId,
    user_id: userId,
    ...fields,
  };

  if (seed?.full_name != null) {
    payload.full_name = seed.full_name;
  }
  if (seed?.email != null) {
    payload.email = seed.email;
  }

  return payload;
}

function isRlsError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42501" ||
    Boolean(error.message?.toLowerCase().includes("row-level security"))
  );
}

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
    .limit(1);

  if (error) {
    console.error("[Profiles] Profile lookup failed", {
      userId,
      error: error.message,
    });
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  const profile = firstRow(data as Profile[] | null);
  console.log("[Profiles] Profile lookup", {
    userId,
    found: Boolean(profile),
    profileId: profile?.id ?? null,
    rowCount: data?.length ?? 0,
  });

  return profile;
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
      user_id: userId,
      full_name: seed?.full_name ?? null,
      email: seed?.email ?? null,
    })
    .select("*");

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

  const created = firstRow(data as Profile[] | null);
  if (!created) {
    throw new Error("Failed to create profile: insert returned no row.");
  }

  console.log("[Profiles] Profile created", { userId, profileId: created.id });
  return created;
}

export async function upsertProfile(
  supabase: Client,
  userId: string,
  fields: ProfileUpdate,
  seed?: ProfileSeed
): Promise<Profile> {
  const payload = buildProfilePayload(userId, fields, seed);

  console.log("[Profiles] Upserting profile", {
    userId,
    fields: Object.keys(fields),
  });

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*");

  if (error) {
    console.error("[Profiles] Profile upsert failed", {
      userId,
      error: error.message,
      code: error.code,
      rls: isRlsError(error),
    });

    if (isRlsError(error)) {
      console.warn("[Profiles] Retrying via ensureProfile + update after RLS upsert failure", {
        userId,
      });
      await ensureProfile(supabase, userId, seed);
      return updateProfile(supabase, userId, fields, seed);
    }

    throw new Error(`Failed to save profile: ${error.message}`);
  }

  const saved = firstRow(data as Profile[] | null);
  if (saved) {
    console.log("[Profiles] Profile upserted", { userId, profileId: saved.id });
    return saved;
  }

  console.warn("[Profiles] Upsert returned no row — falling back to ensure+update", {
    userId,
  });

  await ensureProfile(supabase, userId, seed);
  return updateProfile(supabase, userId, fields, seed);
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
    .select("*");

  if (error) {
    console.error("[Profiles] Profile update failed", {
      userId,
      error: error.message,
    });
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  const updated = firstRow(data as Profile[] | null);
  if (updated) {
    console.log("[Profiles] Profile updated", { userId, profileId: updated.id });
    return updated;
  }

  console.warn("[Profiles] Profile update matched no rows — ensuring profile", {
    userId,
  });

  await ensureProfile(supabase, userId, seed);

  const { data: retryData, error: retryError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*");

  if (retryError) {
    console.error("[Profiles] Profile update retry failed", {
      userId,
      error: retryError.message,
    });
    throw new Error(`Failed to update profile: ${retryError.message}`);
  }

  const retryRow = firstRow(retryData as Profile[] | null);
  if (!retryRow) {
    throw new Error("Failed to update profile: profile row still missing.");
  }

  console.log("[Profiles] Profile updated after ensure", {
    userId,
    profileId: retryRow.id,
  });

  return retryRow;
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

  return upsertProfile(supabase, userId, updates, seed);
}

export async function disconnectGoogleCalendar(
  supabase: Client,
  userId: string,
  seed?: ProfileSeed
): Promise<Profile> {
  return upsertProfile(
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
  return upsertProfile(
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
