import { NextResponse } from "next/server";
import { saveGoogleTokens } from "@/lib/data/profiles";
import { exchangeGoogleCode } from "@/lib/google-calendar/oauth";
import { createClient } from "@/lib/supabase/server";

function getSiteUrl(request: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin
  );
}

export async function GET(request: Request) {
  const siteUrl = getSiteUrl(request);
  const redirectBase = `${siteUrl}/settings/calendar`;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?error=missing_code`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`);
  }

  const cookieStore = request.headers.get("cookie") ?? "";
  const stateCookie = cookieStore
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("google_oauth_state="))
    ?.split("=")[1];

  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_state`);
  }

  try {
    const parsedState = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { userId?: string };

    if (parsedState.userId !== user.id) {
      return NextResponse.redirect(`${redirectBase}?error=invalid_user`);
    }

    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${redirectBase}?error=no_refresh_token`
      );
    }

    await saveGoogleTokens(supabase, user.id, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "oauth_callback_failed";
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(message)}`
    );
  }

  const response = NextResponse.redirect(`${redirectBase}?connected=1`);
  response.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}
