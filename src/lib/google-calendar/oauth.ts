import { google } from "googleapis";
import {
  getGoogleOAuthConfig,
  GOOGLE_CALENDAR_SCOPES,
} from "@/lib/google-calendar/config";
import type { Profile } from "@/types/database";

export function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function getAuthorizedCalendarClient(profile: Profile) {
  if (!profile.google_refresh_token) {
    throw new Error("Google Calendar is not connected for this account.");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: profile.google_refresh_token,
    access_token: profile.google_access_token ?? undefined,
    expiry_date: profile.google_token_expires_at
      ? new Date(profile.google_token_expires_at).getTime()
      : undefined,
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function listGoogleCalendars(profile: Profile) {
  const calendar = getAuthorizedCalendarClient(profile);
  const response = await calendar.calendarList.list({ maxResults: 50 });
  return (response.data.items ?? []).map((item) => ({
    id: item.id ?? "primary",
    summary: item.summary ?? item.id ?? "Calendar",
    primary: Boolean(item.primary),
  }));
}
