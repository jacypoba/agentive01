import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { listUserWorkspaces } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/types/database";

export type OperationalAuthMethod = "cron_secret" | "workspace_admin";

export type OperationalAuthSuccess = {
  ok: true;
  method: OperationalAuthMethod;
  userId?: string;
};

export type OperationalAuthFailure = {
  ok: false;
  reason: "missing_credentials" | "invalid_cron_secret" | "not_workspace_admin";
};

export type OperationalAuthOptions = {
  /** Allow Authorization: Bearer / x-cron-secret matching CRON_SECRET. Default true. */
  allowCronSecret?: boolean;
  /** Allow authenticated workspace owner or admin. Default true. */
  allowWorkspaceAdmin?: boolean;
};

const ADMIN_ROLES = new Set<WorkspaceRole>(["owner", "admin"]);

export function extractCronSecretFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    return token || null;
  }

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  return headerSecret || null;
}

export function isCronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

export function isCronSecretAuthorized(request: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) {
    return false;
  }

  const provided = extractCronSecretFromRequest(request);
  if (!provided) {
    return false;
  }

  try {
    const expected = Buffer.from(configured);
    const received = Buffer.from(provided);
    if (expected.length !== received.length) {
      return false;
    }
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function hasWorkspaceAdminRole(
  workspaces: Array<{ role: WorkspaceRole }>
): boolean {
  return workspaces.some((workspace) => ADMIN_ROLES.has(workspace.role));
}

export function getRequestClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    null
  );
}

export function logOperationalAccessDenied(
  request: Request,
  route: string,
  failure: OperationalAuthFailure
): void {
  console.warn("[OPERATIONAL ACCESS DENIED]", {
    route,
    reason: failure.reason,
    timestamp: new Date().toISOString(),
    ip: getRequestClientIp(request),
    hasCronHeader: Boolean(extractCronSecretFromRequest(request)),
    hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
    userAgent: request.headers.get("user-agent") ?? null,
  });
}

export async function authorizeOperationalEndpoint(
  request: Request,
  route: string,
  options: OperationalAuthOptions = {}
): Promise<OperationalAuthSuccess | OperationalAuthFailure> {
  const allowCronSecret = options.allowCronSecret ?? true;
  const allowWorkspaceAdmin = options.allowWorkspaceAdmin ?? true;

  if (allowCronSecret && isCronSecretAuthorized(request)) {
    return { ok: true, method: "cron_secret" };
  }

  if (allowWorkspaceAdmin) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const workspaces = await listUserWorkspaces(supabase, user.id);
      if (hasWorkspaceAdminRole(workspaces)) {
        return { ok: true, method: "workspace_admin", userId: user.id };
      }

      if (extractCronSecretFromRequest(request)) {
        return { ok: false, reason: "invalid_cron_secret" };
      }

      return { ok: false, reason: "not_workspace_admin" };
    }
  }

  if (extractCronSecretFromRequest(request)) {
    return { ok: false, reason: "invalid_cron_secret" };
  }

  return { ok: false, reason: "missing_credentials" };
}

export async function requireOperationalAccess(
  request: Request,
  route: string,
  options?: OperationalAuthOptions
): Promise<OperationalAuthSuccess | NextResponse> {
  const auth = await authorizeOperationalEndpoint(request, route, options);

  if (!auth.ok) {
    logOperationalAccessDenied(request, route, auth);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return auth;
}

export async function guardOperationalRoute(
  request: Request,
  route: string,
  options?: OperationalAuthOptions
): Promise<NextResponse | null> {
  const auth = await requireOperationalAccess(request, route, options);
  if (auth instanceof NextResponse) {
    return auth;
  }
  return null;
}
