import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlanAccessError } from "@/lib/billing/plan-limits";
import {
  isSubscriptionBillingBlockError,
  WorkspaceSubscriptionInactiveError,
} from "@/lib/billing/workspace-subscription";

describe("WorkspaceSubscriptionInactiveError", () => {
  it("is a PlanAccessError with subscription feature", () => {
    const error = new WorkspaceSubscriptionInactiveError();
    assert.equal(error.name, "WorkspaceSubscriptionInactiveError");
    assert.equal(error.code, "subscription_inactive");
    assert.equal(error.feature, "subscription");
    assert.ok(error instanceof PlanAccessError);
    assert.match(error.message, /inactive/i);
  });
});

describe("isSubscriptionBillingBlockError", () => {
  it("matches WorkspaceSubscriptionInactiveError", () => {
    assert.equal(
      isSubscriptionBillingBlockError(new WorkspaceSubscriptionInactiveError()),
      true
    );
  });

  it("matches PlanAccessError for subscription feature", () => {
    assert.equal(
      isSubscriptionBillingBlockError(
        new PlanAccessError("Inactive.", "subscription")
      ),
      true
    );
  });

  it("does not match plan feature or limit errors", () => {
    assert.equal(
      isSubscriptionBillingBlockError(
        new PlanAccessError("Upgrade for analytics.", "analytics")
      ),
      false
    );
    assert.equal(
      isSubscriptionBillingBlockError(
        new PlanAccessError("Lead limit.", "limit")
      ),
      false
    );
  });

  it("does not match unrelated errors", () => {
    assert.equal(isSubscriptionBillingBlockError(new Error("network")), false);
    assert.equal(isSubscriptionBillingBlockError(null), false);
  });
});
