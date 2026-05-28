import { NextResponse } from "next/server";
import { saveGoogleTokens, profileSeedFromAuthUser } from "@/lib/data/profiles";
import { exchangeGoogleCode } from "@/lib/google-calendar/oauth";
import { createClient } from "@/lib/supabase/server";

const LOG_PREFIX = "[Google OAuth Callback]";

function getSiteUrl(request: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin
  );
}

function buildRedirectUrl(
  redirectBase: string,
  params: Record<string, string>
): string {
  const url = new URL(redirectBase);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function redirectWithError(
  redirectBase: string,
  step: string,
  message: string
): NextResponse {
  const redirectUrl = buildRedirectUrl(redirectBase, {
    step,
    error: message,
  });

  console.error(LOG_PREFIX, {
    event: "redirect_error",
    step,
    message,
    redirectUrl,
  });

  return NextResponse.redirect(redirectUrl);
}

function redirectSuccess(redirectBase: string): NextResponse {
  const redirectUrl = buildRedirectUrl(redirectBase, { connected: "1" });

  console.log(LOG_PREFIX, {
    event: "redirect_success",
    redirectUrl,
  });

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}

export async function GET(request: Request) {
  const siteUrl = getSiteUrl(request);
  const redirectBase = `${siteUrl}/settings/calendar`;
  const url = new URL(request.url);

  console.log(LOG_PREFIX, {
    event: "callback_reached",
    path: url.pathname,
    hasCode: url.searchParams.has("code"),
    hasState: url.searchParams.has("state"),
    hasOAuthError: url.searchParams.has("error"),
  });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectWithError(
      redirectBase,
      "google_oauth_denied",
      `Google OAuth error: ${oauthError}`
    );
  }

  if (!code || !state) {
    console.warn(LOG_PREFIX, {
      event: "missing_code_or_state",
      hasCode: Boolean(code),
      hasState: Boolean(state),
    });
    return redirectWithError(
      redirectBase,
      "missing_code_or_state",
      "Missing OAuth code or state from Google redirect."
    );
  }

  console.log(LOG_PREFIX, {
    event: "oauth_params_present",
    hasCode: true,
    hasState: true,
    stateLength: state.length,
  });

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log(LOG_PREFIX, {
    event: "supabase_auth_checked",
    authenticated: Boolean(user),
    supabaseUserId: user?.id ?? null,
    authError: authError?.message ?? null,
  });

  if (!user) {
    const loginUrl = buildRedirectUrl(`${siteUrl}/login`, {
      redirect: "/settings/calendar",
      step: "not_authenticated",
      error: "Sign in required before completing Google Calendar connection.",
    });
    console.warn(LOG_PREFIX, {
      event: "redirect_login",
      redirectUrl: loginUrl,
    });
    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = request.headers.get("cookie") ?? "";
  const stateCookie = cookieStore
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("google_oauth_state="))
    ?.split("=")[1];

  console.log(LOG_PREFIX, {
    event: "state_cookie_checked",
    hasStateCookie: Boolean(stateCookie),
    stateCookieMatches: Boolean(stateCookie && stateCookie === state),
  });

  if (!stateCookie || stateCookie !== state) {
    return redirectWithError(
      redirectBase,
      "invalid_state",
      "OAuth state cookie mismatch or missing. Try connecting again."
    );
  }

  let stateUserId: string | null = null;

  try {
    const parsedState = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { userId?: string };

    stateUserId = parsedState.userId ?? null;

    console.log(LOG_PREFIX, {
      event: "state_parsed",
      stateUserId,
      supabaseUserId: user.id,
      userIdsMatch: parsedState.userId === user.id,
    });

    if (parsedState.userId !== user.id) {
      return redirectWithError(
        redirectBase,
        "invalid_user",
        `OAuth state user mismatch. stateUserId=${parsedState.userId ?? "null"} authUserId=${user.id}`
      );
    }

    console.log(LOG_PREFIX, {
      event: "token_exchange_start",
      userId: user.id,
    });

    let tokens;
    try {
      tokens = await exchangeGoogleCode(code);
    } catch (exchangeError) {
      const message =
        exchangeError instanceof Error
          ? exchangeError.message
          : "token_exchange_failed";
      console.error(LOG_PREFIX, {
        event: "token_exchange_failed",
        userId: user.id,
        message,
        stack:
          exchangeError instanceof Error ? exchangeError.stack : undefined,
      });
      return redirectWithError(
        redirectBase,
        "token_exchange_failed",
        `Google token exchange failed: ${message}`
      );
    }

    console.log(LOG_PREFIX, {
      event: "token_exchange_success",
      userId: user.id,
      hasRefreshToken: Boolean(tokens.refresh_token),
      hasAccessToken: Boolean(tokens.access_token),
      hasExpiry: Boolean(tokens.expiry_date),
    });

    if (!tokens.refresh_token) {
      return redirectWithError(
        redirectBase,
        "no_refresh_token",
        "Google did not return a refresh token. Disconnect the app in Google Account permissions and try again."
      );
    }

    console.log(LOG_PREFIX, {
      event: "profile_upsert_start",
      userId: user.id,
      email: user.email,
    });

    let profile;
    try {
      profile = await saveGoogleTokens(
        supabase,
        user.id,
        {
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date,
        },
        profileSeedFromAuthUser(user)
      );
    } catch (profileError) {
      const message =
        profileError instanceof Error
          ? profileError.message
          : "profile_upsert_failed";
      console.error(LOG_PREFIX, {
        event: "profile_upsert_failed",
        userId: user.id,
        message,
        stack: profileError instanceof Error ? profileError.stack : undefined,
      });
      return redirectWithError(
        redirectBase,
        "profile_upsert_failed",
        `Profile save failed: ${message}`
      );
    }

    console.log(LOG_PREFIX, {
      event: "profile_upsert_success",
      userId: user.id,
      profileId: profile.id,
      connectedAt: profile.google_calendar_connected_at,
      hasStoredRefreshToken: Boolean(profile.google_refresh_token),
      hasStoredAccessToken: Boolean(profile.google_access_token),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "oauth_callback_failed";
    console.error(LOG_PREFIX, {
      event: "unexpected_error",
      userId: user.id,
      stateUserId,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return redirectWithError(redirectBase, "unexpected_error", message);
  }

  return redirectSuccess(redirectBase);
}
