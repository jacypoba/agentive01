import type { Metadata } from "next";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "Google OAuth debug — Agentive01",
  robots: "noindex, nofollow",
};

function maskToken(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export default async function DebugGooglePage() {
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

  let redirectUri = "—";
  let oauthConfigError: string | null = null;
  if (isGoogleCalendarConfigured()) {
    try {
      redirectUri = getGoogleOAuthConfig().redirectUri;
    } catch (error) {
      oauthConfigError =
        error instanceof Error ? error.message : "oauth_config_invalid";
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Google OAuth debug</h1>
      <p className="mt-2 text-sm text-white/50">
        Temporary diagnostics for Google Calendar connection. JSON:{" "}
        <Link href="/api/debug/google-status" className="text-[#00D4FF] hover:underline">
          /api/debug/google-status
        </Link>
      </p>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-semibold text-white">Auth</h2>
        <dl className="mt-3 space-y-2 font-mono text-xs text-white/70">
          <div>authenticated: {String(Boolean(user))}</div>
          <div>userId: {user?.id ?? "—"}</div>
          <div>email: {user?.email ?? "—"}</div>
          <div>authError: {authError?.message ?? "—"}</div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-semibold text-white">Env / OAuth config</h2>
        <dl className="mt-3 space-y-2 font-mono text-xs text-white/70">
          <div>googleConfigured: {String(isGoogleCalendarConfigured())}</div>
          <div>GOOGLE_CLIENT_ID set: {String(Boolean(process.env.GOOGLE_CLIENT_ID))}</div>
          <div>GOOGLE_CLIENT_SECRET set: {String(Boolean(process.env.GOOGLE_CLIENT_SECRET))}</div>
          <div>GOOGLE_REDIRECT_URI set: {String(Boolean(process.env.GOOGLE_REDIRECT_URI))}</div>
          <div>redirectUri: {redirectUri}</div>
          <div>NEXT_PUBLIC_SITE_URL: {process.env.NEXT_PUBLIC_SITE_URL ?? "—"}</div>
          <div>oauthConfigError: {oauthConfigError ?? "—"}</div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-semibold text-white">Profile / tokens</h2>
        <dl className="mt-3 space-y-2 font-mono text-xs text-white/70">
          <div>profileFound: {String(Boolean(profile))}</div>
          <div>profileLookupError: {profileError ?? "—"}</div>
          <div>connected: {String(isGoogleCalendarConnected(profile))}</div>
          <div>connectedAt: {profile?.google_calendar_connected_at ?? "—"}</div>
          <div>refreshToken: {maskToken(profile?.google_refresh_token)}</div>
          <div>accessToken: {maskToken(profile?.google_access_token)}</div>
          <div>tokenExpiresAt: {profile?.google_token_expires_at ?? "—"}</div>
          <div>calendarId: {settings.googleCalendarId}</div>
          <div>workHours: {settings.workStart}–{settings.workEnd}</div>
          <div>visitDuration: {settings.visitDurationMinutes} min</div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm text-emerald-100">
        <p>
          Connect flow:{" "}
          <Link href="/api/integrations/google/connect" className="underline">
            /api/integrations/google/connect
          </Link>{" "}
          → Google → callback →{" "}
          <Link href="/settings/calendar" className="underline">
            /settings/calendar
          </Link>
        </p>
        <p className="mt-2 text-xs text-emerald-200/80">
          On failure, check Vercel logs for{" "}
          <code className="rounded bg-black/30 px-1">[Google OAuth Callback]</code>{" "}
          and the <code className="rounded bg-black/30 px-1">step</code> query param on
          the calendar settings URL.
        </p>
      </section>
    </main>
  );
}
