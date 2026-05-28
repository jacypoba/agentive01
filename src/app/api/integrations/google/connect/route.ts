import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar/oauth";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/config";

export async function GET(request: Request) {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar is not configured on the server." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, nonce: crypto.randomUUID() })
  ).toString("base64url");

  const url = getGoogleAuthUrl(state);
  const response = NextResponse.redirect(url);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
