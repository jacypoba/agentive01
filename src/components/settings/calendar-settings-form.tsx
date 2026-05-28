"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  disconnectGoogleCalendarAction,
  fetchGoogleCalendarsAction,
  saveCalendarSettingsAction,
  type CalendarSettingsState,
} from "@/app/actions/calendar-settings";

type CalendarOption = { id: string; summary: string; primary: boolean };

type CalendarSettingsFormProps = {
  connected: boolean;
  connectedAt: string | null;
  googleConfigured: boolean;
  settings: {
    googleCalendarId: string;
    workStart: string;
    workEnd: string;
    visitDurationMinutes: number;
  };
  oauthError?: string | null;
  oauthStep?: string | null;
  oauthConnected?: boolean;
};

const initialState: CalendarSettingsState = {};

export function CalendarSettingsForm({
  connected,
  connectedAt,
  googleConfigured,
  settings,
  oauthError,
  oauthStep,
  oauthConnected,
}: CalendarSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveCalendarSettingsAction,
    initialState
  );
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!connected) return;

    setLoadingCalendars(true);
    fetchGoogleCalendarsAction()
      .then((result) => {
        if (result.calendars) {
          setCalendars(result.calendars);
        }
      })
      .finally(() => setLoadingCalendars(false));
  }, [connected]);

  async function handleDisconnect() {
    setDisconnectMessage(null);
    const result = await disconnectGoogleCalendarAction();
    setDisconnectMessage(result.success ?? result.error ?? null);
  }

  return (
    <div className="space-y-6">
      {oauthError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          <p className="font-medium">Google connection failed</p>
          {oauthStep && (
            <p className="mt-1 font-mono text-xs text-red-300/80">
              step: {oauthStep}
            </p>
          )}
          <p className="mt-2">{oauthError}</p>
          <p className="mt-3 text-xs text-red-200/70">
            Debug:{" "}
            <Link href="/debug-google" className="underline">
              /debug-google
            </Link>{" "}
            ·{" "}
            <Link href="/api/debug/google-status" className="underline">
              /api/debug/google-status
            </Link>
          </p>
        </div>
      )}

      {oauthConnected && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          Google Calendar connected successfully.
        </div>
      )}

      {(state.error || disconnectMessage) && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {state.error ?? disconnectMessage}
        </div>
      )}

      {(state.success || disconnectMessage) && !state.error && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          {state.success ?? disconnectMessage}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold">Google account</h2>
        <p className="mt-1 text-sm text-white/45">
          Connect your calendar to auto-create visit events and check conflicts.
        </p>

        {!googleConfigured && (
          <p className="mt-4 text-sm text-amber-200">
            Server missing Google OAuth env vars. Add{" "}
            <code className="rounded bg-black/30 px-1 text-xs">GOOGLE_CLIENT_ID</code>,{" "}
            <code className="rounded bg-black/30 px-1 text-xs">GOOGLE_CLIENT_SECRET</code>, and{" "}
            <code className="rounded bg-black/30 px-1 text-xs">GOOGLE_REDIRECT_URI</code>.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {connected ? (
            <>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                Connected
                {connectedAt
                  ? ` · ${new Date(connectedAt).toLocaleDateString("pt-PT")}`
                  : ""}
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20"
              >
                Disconnect
              </button>
            </>
          ) : (
            <Link
              href="/api/integrations/google/connect"
              className={`rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-5 py-2.5 text-sm font-semibold text-white ${
                googleConfigured ? "" : "pointer-events-none opacity-50"
              }`}
            >
              Connect Google Calendar
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold">Scheduling preferences</h2>
        <p className="mt-1 text-sm text-white/45">
          Used for conflict checks and automatic event duration.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              Default calendar
            </span>
            {connected && calendars.length > 0 ? (
              <select
                name="google_calendar_id"
                defaultValue={settings.googleCalendarId}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white"
              >
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.summary}
                    {calendar.primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="google_calendar_id"
                defaultValue={settings.googleCalendarId}
                placeholder="primary"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white"
              />
            )}
            {loadingCalendars && (
              <p className="mt-1 text-xs text-white/35">Loading calendars…</p>
            )}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                Work start
              </span>
              <input
                name="work_start"
                type="time"
                required
                defaultValue={settings.workStart}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                Work end
              </span>
              <input
                name="work_end"
                type="time"
                required
                defaultValue={settings.workEnd}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              Visit duration (minutes)
            </span>
            <input
              name="visit_duration_minutes"
              type="number"
              min={15}
              max={240}
              step={15}
              required
              defaultValue={settings.visitDurationMinutes}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white"
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save settings"}
          </button>
        </form>
      </section>
    </div>
  );
}
