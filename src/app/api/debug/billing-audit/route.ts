import { NextResponse } from "next/server";
import { getSubscriptionByWorkspaceId } from "@/lib/billing/subscriptions";
import { getPlanLimits } from "@/lib/billing/plan-limits";
import { requireOperationalAccess } from "@/lib/security/operational-endpoint-auth";
import {
  areAllStripePricesConfigured,
  getStripeEnvDiagnostics,
} from "@/lib/stripe/plan-prices.server";
import { getAppUrl } from "@/lib/stripe/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/get-current-workspace";

const ROUTE = "/api/debug/billing-audit";

export async function GET(request: Request) {
  const auth = await requireOperationalAccess(request, ROUTE);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const url = new URL(request.url);
  const requestedWorkspaceId = url.searchParams.get("workspace_id")?.trim();

  let workspaceId: string | null = requestedWorkspaceId ?? null;
  const supabase = await createClient();

  if (auth.method === "workspace_admin" && auth.userId) {
    const activeWorkspaceId = await getCurrentWorkspaceId(supabase, auth.userId);
    if (requestedWorkspaceId) {
      const { assertWorkspaceAccess } = await import(
        "@/lib/workspaces/workspace-access"
      );
      await assertWorkspaceAccess(supabase, auth.userId, requestedWorkspaceId);
      workspaceId = requestedWorkspaceId;
    } else {
      workspaceId = activeWorkspaceId;
    }
  }

  const stripeEnv = getStripeEnvDiagnostics();
  const missingConfig: string[] = [];

  if (!stripeEnv.secretKeyConfigured) {
    missingConfig.push("STRIPE_SECRET_KEY");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    missingConfig.push("STRIPE_WEBHOOK_SECRET");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    missingConfig.push("NEXT_PUBLIC_APP_URL");
  }
  for (const [planId, configured] of Object.entries(stripeEnv.prices)) {
    if (!configured) {
      missingConfig.push(`STRIPE_PRICE_${planId.toUpperCase()}`);
    }
  }

  let subscription = null;
  let webhookHealth: {
    dedupTableReachable: boolean;
    recentEvents24h: number | null;
    lastEventAt: string | null;
    error: string | null;
  } = {
    dedupTableReachable: false,
    recentEvents24h: null,
    lastEventAt: null,
    error: null,
  };

  const admin = createAdminClient();

  if (workspaceId) {
    subscription = await getSubscriptionByWorkspaceId(admin, workspaceId);
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("stripe_webhook_events")
      .select("*", { count: "exact", head: true })
      .gte("processed_at", since);

    const { data: lastEvent, error: lastError } = await admin
      .from("stripe_webhook_events")
      .select("processed_at, event_type")
      .order("processed_at", { ascending: false })
      .limit(1);

    if (countError || lastError) {
      webhookHealth = {
        dedupTableReachable: false,
        recentEvents24h: null,
        lastEventAt: null,
        error: countError?.message ?? lastError?.message ?? "Unknown error",
      };
    } else {
      webhookHealth = {
        dedupTableReachable: true,
        recentEvents24h: count ?? 0,
        lastEventAt: lastEvent?.[0]?.processed_at ?? null,
        error: null,
      };
    }
  } catch (error) {
    webhookHealth.error =
      error instanceof Error ? error.message : "Webhook health check failed";
  }

  const planLimits = subscription
    ? getPlanLimits(subscription.plan_name)
    : getPlanLimits("starter");

  return NextResponse.json({
    debugLabel: "billing-audit-v1",
    timestamp: new Date().toISOString(),
    accessMethod: auth.method,
    workspaceId,
    appUrl: getAppUrl(),
    stripe: {
      testMode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false,
      pricesConfigured: areAllStripePricesConfigured(),
      env: stripeEnv,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          workspace_id: subscription.workspace_id,
          user_id: subscription.user_id,
          plan_name: subscription.plan_name,
          subscription_status: subscription.subscription_status,
          stripe_customer_id_present: Boolean(subscription.stripe_customer_id),
          stripe_subscription_id_present: Boolean(
            subscription.stripe_subscription_id
          ),
          stripe_price_id: subscription.stripe_price_id,
          current_period_end: subscription.current_period_end,
          trial_ends_at: subscription.trial_ends_at,
          updated_at: subscription.updated_at,
        }
      : null,
    planLimits,
    missingConfig,
    webhookHealth,
    notes: [
      "Billing is workspace-scoped (subscriptions.workspace_id unique).",
      "Checkout/portal require owner or admin on the active workspace.",
      "Webhook signature validated via STRIPE_WEBHOOK_SECRET.",
      "Client UI never trusts billing state — webhooks upsert subscriptions.",
    ],
  });
}
