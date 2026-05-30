import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listUserWorkspaces } from "@/lib/workspaces/get-current-workspace";

type TenantTableSpec = {
  table: string;
  domain: string;
  hasWorkspaceId: boolean;
  rlsExpected: boolean;
  notes?: string;
};

const TENANT_TABLE_REGISTRY: TenantTableSpec[] = [
  { table: "leads", domain: "CRM", hasWorkspaceId: true, rlsExpected: true },
  { table: "properties", domain: "Inventory", hasWorkspaceId: true, rlsExpected: true },
  { table: "visit_requests", domain: "Visits", hasWorkspaceId: true, rlsExpected: true },
  { table: "follow_ups", domain: "Follow-ups", hasWorkspaceId: true, rlsExpected: true },
  { table: "conversations", domain: "AI/Messages", hasWorkspaceId: true, rlsExpected: true },
  {
    table: "subscriptions",
    domain: "Billing",
    hasWorkspaceId: true,
    rlsExpected: true,
    notes: "Workspace-scoped billing (unique per workspace).",
  },
  {
    table: "workspace_settings",
    domain: "AI settings",
    hasWorkspaceId: true,
    rlsExpected: true,
    notes: "Per-workspace tone, FAQs, business info.",
  },
  {
    table: "workspace_whatsapp_connections",
    domain: "WhatsApp routing",
    hasWorkspaceId: true,
    rlsExpected: true,
    notes: "Maps Meta phone_number_id / Evolution instance → workspace.",
  },
  {
    table: "processed_whatsapp_messages",
    domain: "WhatsApp dedup",
    hasWorkspaceId: true,
    rlsExpected: false,
    notes: "Optional workspace_id; global dedup key remains (message_id, instance).",
  },
  {
    table: "whatsapp_webhook_heartbeat",
    domain: "Ops diagnostics",
    hasWorkspaceId: false,
    rlsExpected: false,
    notes: "Global singleton rows — service role only.",
  },
  {
    table: "profiles",
    domain: "User profile",
    hasWorkspaceId: false,
    rlsExpected: true,
    notes: "User-scoped; default_workspace_id for active tenant. Calendar tokens per user.",
  },
];

const RISKY_ROUTES = [
  {
    route: "/api/debug/evolution-send",
    risk: "Unauthenticated WhatsApp send diagnostic",
    recommendation: "Gate with CRON_SECRET or restrict to non-production.",
  },
  {
    route: "/api/debug/whatsapp-health",
    risk: "Public provider health + optional live ping",
    recommendation: "Require auth or CRON_SECRET in production.",
  },
  {
    route: "/api/cron/follow-ups",
    risk: "Processes all workspaces when using admin client",
    recommendation: "Acceptable for cron; ensure CRON_SECRET is set in production.",
  },
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await listUserWorkspaces(supabase, user.id);
  const admin = createAdminClient();

  const nullWorkspaceCounts: Record<string, number | null> = {};
  for (const spec of TENANT_TABLE_REGISTRY.filter((item) => item.hasWorkspaceId)) {
    const { count, error } = await admin
      .from(spec.table as "leads")
      .select("*", { count: "exact", head: true })
      .is("workspace_id", null);

    nullWorkspaceCounts[spec.table] = error ? null : count ?? 0;
  }

  const { count: whatsappConnections } = await admin
    .from("workspace_whatsapp_connections")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return NextResponse.json({
    debugLabel: "multitenancy-audit-v1",
    timestamp: new Date().toISOString(),
    phase: "2 — workspace-scoped reads + RLS",
    authenticatedUserId: user.id,
    workspaceMemberships: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      role: workspace.role,
    })),
    tables: TENANT_TABLE_REGISTRY.map((spec) => ({
      ...spec,
      nullableWorkspaceRows: spec.hasWorkspaceId
        ? nullWorkspaceCounts[spec.table]
        : null,
    })),
    rls: {
      helperFunction: "public.is_workspace_member(uuid)",
      tenantTablesPolicy: "workspace membership OR legacy user_id fallback",
      subscriptionsPolicy: "workspace membership",
      serviceRoleBypass: true,
    },
    applicationGuards: {
      resolveTenantScope: "src/lib/workspaces/workspace-access.ts",
      assertWorkspaceAccess: "src/lib/workspaces/workspace-access.ts",
      getActiveWorkspace: "alias for getCurrentWorkspace",
      getUserWorkspaces: "alias for listUserWorkspaces",
      whatsappTenantRouting: "src/lib/workspaces/resolve-whatsapp-tenant.ts",
    },
    whatsappRouting: {
      activeConnections: whatsappConnections ?? 0,
      fallbackEnv: "WHATSAPP_DEFAULT_USER_ID → user's active workspace",
      metaField: "phone_number_id",
      evolutionField: "instance name",
    },
    billing: {
      scopedBy: "workspace_id",
      table: "subscriptions",
      notes: "Checkout/portal resolve workspace via getCurrentWorkspaceId.",
    },
    calendar: {
      scopedBy: "user profile (google_* columns)",
      notes:
        "Calendar OAuth remains per-user. Visit events inherit workspace via visit_requests.workspace_id.",
    },
    riskyRoutes: RISKY_ROUTES,
    recommendedFixes: [
      ...(Object.entries(nullWorkspaceCounts)
        .filter(([, count]) => typeof count === "number" && count > 0)
        .map(
          ([table, count]) =>
            `Backfill ${count} row(s) with null workspace_id in ${table}.`
        )),
      ...(whatsappConnections === 0
        ? [
            "Add workspace_whatsapp_connections rows for each Meta phone_number_id before multi-tenant production.",
          ]
        : []),
      "Set CRON_SECRET and restrict debug routes in production deployments.",
    ],
  });
}
