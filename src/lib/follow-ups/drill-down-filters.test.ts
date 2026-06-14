import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterFollowUpsForDrillDown } from "@/lib/follow-ups/drill-down-filters";
import type { FollowUpWithLead } from "@/types/database";

function followUp(
  overrides: Partial<FollowUpWithLead> = {}
): FollowUpWithLead {
  return {
    id: "fu-1",
    lead_id: "lead-1",
    user_id: "user-1",
    workspace_id: "ws-1",
    type: "silent_lead",
    status: "sent",
    message: "Hello",
    scheduled_for: "2026-05-01T10:00:00.000Z",
    sent_at: "2026-05-01T10:00:00.000Z",
    context_snapshot: null,
    created_at: "2026-05-01T09:00:00.000Z",
    leads: {
      id: "lead-1",
      client_name: "Test Lead",
      phone: null,
      phone_normalized: null,
      status: "new",
      intent_status: null,
      preferred_area: null,
      property_type: null,
      budget: null,
      user_id: "user-1",
      preferred_language: null,
    },
    ...overrides,
  };
}

describe("follow-up drill-down filters", () => {
  it("filters sent follow-ups to today only", () => {
    const todaySent = followUp({ id: "today", sent_at: new Date().toISOString() });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const oldSent = followUp({
      id: "old",
      sent_at: yesterday.toISOString(),
    });

    const filtered = filterFollowUpsForDrillDown([todaySent, oldSent], {
      today: true,
    });

    assert.deepEqual(
      filtered.map((item) => item.id),
      ["today"]
    );
  });

  it("filters sent follow-ups by analytics period", () => {
    const inRange = followUp({
      id: "in-range",
      sent_at: new Date().toISOString(),
    });
    const outOfRange = followUp({
      id: "out-of-range",
      sent_at: "2000-01-01T00:00:00.000Z",
    });

    const filtered = filterFollowUpsForDrillDown([inRange, outOfRange], {
      period: "30",
    });

    assert.deepEqual(
      filtered.map((item) => item.id),
      ["in-range"]
    );
  });

  it("returns all items when no drill-down filters are set", () => {
    const items = [followUp({ id: "a" }), followUp({ id: "b" })];
    assert.equal(filterFollowUpsForDrillDown(items, {}).length, 2);
  });
});
