import { NextResponse } from "next/server";
import {
  getCalendarSettingsFromProfile,
  getProfile,
  isGoogleCalendarConnected,
} from "@/lib/data/profiles";
import {
  getGoogleOAuthConfig,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar/config";
import { createClient } from "@/lib/supabase/server";

function maskToken(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let profile = null;
  let profileError: string | null = null;

  if (user) {
    try {
      profile = await getProfile(supabase, user.id);
    } catch (error) {
      profileError =
        error instanceof Error ? error.message : "profile_lookup_failed";
    }
  }

  const settings = getCalendarSettingsFromProfile(profile);
  let redirectUri: string | null = null;
  let oauthConfigError: string | null = null;

  if (isGoogleCalendarConfigured()) {
    try {
      redirectUri = getGoogleOAuthConfig().redirectUri;
    } catch (error) {
      oauthConfigError =
        error instanceof Error ? error.message : "oauth_config_invalid";
    }
  }

  return NextResponse.json({
    debugLabel: "google-oauth-status-v1",
    timestamp: new Date().toISOString(),
    auth: {
      authenticated: Boolean(user),
      userId: user?.id ?? null,
      email: user?.email ?? null,
      authError: authError?.message ?? null,
    },
    env: {
      googleConfigured: isGoogleCalendarConfigured(),
      hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      hasRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
      redirectUri,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      oauthConfigError,
    },
    profile: {
      found: Boolean(profile),
      profileId: profile?.id ?? null,
      lookupError: profileError,
      connected: isGoogleCalendarConnected(profile),
      connectedAt: profile?.google_calendar_connected_at ?? null,
      googleCalendarId: profile?.google_calendar_id ?? null,
      refreshToken: maskToken(profile?.google_refresh_token),
      accessToken: maskToken(profile?.google_access_token),
      tokenExpiresAt: profile?.google_token_expires_at ?? null,
      workStart: settings.workStart,
      workEnd: settings.workEnd,
      visitDurationMinutes: settings.visitDurationMinutes,
    },
    routes: {
      connect: "/api/integrations/google/connect",
      callback: "/api/integrations/google/callback",
      settings: "/settings/calendar",
      debugPage: "/debug-google",
    },
  });
}
