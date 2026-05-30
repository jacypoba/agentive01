import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPlanAccess,
  assertWithinNumericLimit,
  getPlanLimits,
  isSubscriptionActiveForAccess,
  PlanAccessError,
  PLAN_LIMITS,
} from "@/lib/billing/plan-limits";
import {
  isBillingAdminRole,
} from "@/lib/billing/workspace-subscription";
import {
  getSubscriptionIdFromInvoice,
  resolveWebhookWorkspaceContext,
} from "@/lib/billing/webhook-workspace";
import type { CurrentSubscription, Subscription } from "@/types/database";

function mockSubscription(
  overrides: Partial<CurrentSubscription> = {}
): CurrentSubscription {
  return {
    id: "sub-1",
    workspace_id: "ws-1",
    user_id: "user-1",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    plan_name: "starter",
    subscription_status: "active",
    current_period_end: null,
    trial_ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    isTrialing: false,
    isActive: true,
    daysLeftInTrial: null,
    ...overrides,
  };
}

describe("getPlanLimits", () => {
  it("returns starter limits by default", () => {
    const limits = getPlanLimits("starter");
    assert.equal(limits.maxLeads, PLAN_LIMITS.starter.maxLeads);
    assert.equal(limits.followUpsEnabled, false);
  });

  it("returns unlimited leads for enterprise", () => {
    const limits = getPlanLimits("enterprise");
    assert.equal(limits.maxLeads, null);
    assert.equal(limits.followUpsEnabled, true);
  });
});

describe("isSubscriptionActiveForAccess", () => {
  it("allows active and past_due subscriptions", () => {
    assert.equal(
      isSubscriptionActiveForAccess(mockSubscription({ subscription_status: "active" })),
      true
    );
    assert.equal(
      isSubscriptionActiveForAccess(mockSubscription({ subscription_status: "past_due" })),
      true
    );
  });

  it("rejects canceled and unpaid subscriptions", () => {
    assert.equal(
      isSubscriptionActiveForAccess(mockSubscription({ subscription_status: "canceled" })),
      false
    );
    assert.equal(
      isSubscriptionActiveForAccess(mockSubscription({ subscription_status: "unpaid" })),
      false
    );
  });

  it("rejects expired trials", () => {
    assert.equal(
      isSubscriptionActiveForAccess(
        mockSubscription({
          subscription_status: "trialing",
          trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
        })
      ),
      false
    );
  });
});

describe("assertPlanAccess", () => {
  it("blocks follow-ups on starter plan", () => {
    assert.throws(
      () => assertPlanAccess(mockSubscription({ plan_name: "starter" }), "follow_ups"),
      (error: unknown) =>
        error instanceof PlanAccessError && error.feature === "follow_ups"
    );
  });

  it("allows analytics on pro plan", () => {
    assert.doesNotThrow(() =>
      assertPlanAccess(mockSubscription({ plan_name: "pro" }), "analytics")
    );
  });
});

describe("assertWithinNumericLimit", () => {
  it("throws when at limit", () => {
    assert.throws(
      () => assertWithinNumericLimit(150, 150, "Lead"),
      (error: unknown) =>
        error instanceof PlanAccessError && error.feature === "limit"
    );
  });

  it("allows unlimited resources", () => {
    assert.doesNotThrow(() => assertWithinNumericLimit(9999, null, "Lead"));
  });
});

describe("isBillingAdminRole", () => {
  it("allows owner and admin only", () => {
    assert.equal(isBillingAdminRole("owner"), true);
    assert.equal(isBillingAdminRole("admin"), true);
    assert.equal(isBillingAdminRole("member"), false);
  });
});

describe("resolveWebhookWorkspaceContext", () => {
  const subscription = {
    id: "sub_stripe_1",
    metadata: { workspace_id: "ws-meta", user_id: "user-meta" },
  } as import("stripe").Stripe.Subscription;

  it("prefers checkout session metadata", () => {
    const result = resolveWebhookWorkspaceContext({
      subscription,
      sessionMetadata: {
        workspace_id: "ws-session",
        user_id: "user-session",
      },
    });

    assert.deepEqual(result, {
      workspaceId: "ws-session",
      userId: "user-session",
    });
  });

  it("falls back to existing subscription row", () => {
    const existing: Subscription = {
      id: "row-1",
      workspace_id: "ws-db",
      user_id: "user-db",
      plan_name: "pro",
      subscription_status: "active",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_stripe_1",
      stripe_price_id: "price_pro",
      current_period_end: null,
      trial_ends_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = resolveWebhookWorkspaceContext({
      subscription: { ...subscription, metadata: {} } as import("stripe").Stripe.Subscription,
      existingSubscription: existing,
    });

    assert.deepEqual(result, {
      workspaceId: "ws-db",
      userId: "user-db",
    });
  });

  it("prevents cross-workspace billing when metadata matches wrong tenant", () => {
    const workspaceA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const workspaceB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    const existing: Subscription = {
      id: "row-1",
      workspace_id: workspaceA,
      user_id: "user-a",
      plan_name: "pro",
      subscription_status: "active",
      stripe_customer_id: "cus_a",
      stripe_subscription_id: "sub_a",
      stripe_price_id: "price_pro",
      current_period_end: null,
      trial_ends_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = resolveWebhookWorkspaceContext({
      subscription: {
        id: "sub_a",
        metadata: {
          workspace_id: workspaceB,
          user_id: "user-b",
        },
      } as import("stripe").Stripe.Subscription,
      sessionMetadata: {
        workspace_id: workspaceB,
        user_id: "user-b",
      },
      existingSubscription: existing,
    });

    assert.equal(result?.workspaceId, workspaceB);
    assert.notEqual(result?.workspaceId, existing.workspace_id);
  });
});

describe("getSubscriptionIdFromInvoice", () => {
  it("reads legacy subscription field", () => {
    const id = getSubscriptionIdFromInvoice({
      subscription: "sub_legacy",
    } as import("stripe").Stripe.Invoice);

    assert.equal(id, "sub_legacy");
  });

  it("reads parent subscription details", () => {
    const id = getSubscriptionIdFromInvoice({
      parent: {
        subscription_details: {
          subscription: "sub_parent",
        },
      },
    } as import("stripe").Stripe.Invoice);

    assert.equal(id, "sub_parent");
  });
});

describe("billing access contract", () => {
  it("checkout and portal require billing admin role", () => {
    assert.equal(isBillingAdminRole("member"), false);
    assert.equal(isBillingAdminRole("owner"), true);
  });

  it("plan limits enforce starter lead cap", () => {
    const limits = getPlanLimits("starter");
    assert.throws(
      () => assertWithinNumericLimit(limits.maxLeads!, limits.maxLeads, "Lead"),
      PlanAccessError
    );
  });
});
