import type { Metadata } from "next";
import { CalendarSettingsForm } from "@/components/settings/calendar-settings-form";
import { getCalendarSettingsFromProfile, getProfile } from "@/lib/data/profiles";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Calendar settings — Agentive01",
};

type CalendarSettingsPageProps = {
  searchParams: Promise<{ error?: string; connected?: string; step?: string }>;
};

export default async function CalendarSettingsPage({
  searchParams,
}: CalendarSettingsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let dbError: string | null = null;

  if (user) {
    try {
      profile = await getProfile(supabase, user.id);
    } catch (error) {
      dbError =
        error instanceof Error ? error.message : "Could not load profile.";
    }
  }

  const settings = getCalendarSettingsFromProfile(profile);

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="animate-fade-up">
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-2 text-sm text-white/50">
            Connect Google Calendar, set working hours, and sync confirmed visits
            automatically.
          </p>
        </section>

        {dbError && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
            Run{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              supabase/migrations/007_google_calendar.sql
            </code>{" "}
            first. {dbError}
          </div>
        )}

        <div className="mt-8">
          <CalendarSettingsForm
            connected={settings.connected}
            connectedAt={settings.connectedAt}
            googleConfigured={isGoogleCalendarConfigured()}
            settings={{
              googleCalendarId: settings.googleCalendarId,
              workStart: settings.workStart,
              workEnd: settings.workEnd,
              visitDurationMinutes: settings.visitDurationMinutes,
            }}
            oauthError={params.error ?? null}
            oauthStep={params.step ?? null}
            oauthConnected={params.connected === "1"}
          />
        </div>
      </div>
    </main>
  );
}
