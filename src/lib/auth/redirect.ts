/** Returns a same-origin relative path safe for post-auth redirects. */
export function sanitizeRedirectPath(
  path: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!path) {
    return fallback;
  }

  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

/** Restricts post-logout redirects to invite acceptance pages. */
export function sanitizeInviteRedirectPath(
  path: string | null | undefined
): string | null {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();
  if (!trimmed.startsWith("/invite/") || trimmed.startsWith("//")) {
    return null;
  }

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "invite" || !segments[1]) {
    return null;
  }

  return trimmed;
}

export function buildLoginRedirectUrl(redirectPath: string): string {
  return `/login?redirect=${encodeURIComponent(sanitizeRedirectPath(redirectPath))}`;
}
