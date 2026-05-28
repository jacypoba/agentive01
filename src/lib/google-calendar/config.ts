export type CalendarSettings = {
  googleCalendarId: string;
  workStart: string;
  workEnd: string;
  visitDurationMinutes: number;
};

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  googleCalendarId: "primary",
  workStart: "09:00",
  workEnd: "18:00",
  visitDurationMinutes: 60,
};

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}
