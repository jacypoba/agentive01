import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countLeadsByAssignee,
  filterLeadsByAssignee,
} from "@/lib/leads/assignment-filters";
import {
  buildMemberLabelMap,
  formatMemberDisplayName,
  getAssigneeLabel,
} from "@/lib/leads/member-display";
import type { Lead } from "@/types/database";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeLead(assignedUserId: string | null): Lead {
  return {
    id: "lead-1",
    user_id: USER_A,
    assigned_user_id: assignedUserId,
    workspace_id: "workspace-1",
    client_name: "Test",
    phone: null,
    phone_normalized: null,
    interest: null,
    status: "new",
    budget: null,
    preferred_area: null,
    property_type: null,
    timeline: null,
    intent_status: null,
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: null,
    pending_property_offer: null,
    last_message_text: null,
    last_message_sender: null,
    last_message_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("assignment filters", () => {
  const leads = [
    makeLead(USER_A),
    { ...makeLead(USER_B), id: "lead-2" },
    { ...makeLead(null), id: "lead-3" },
  ];

  it("filters my leads by assigned_user_id", () => {
    const mine = filterLeadsByAssignee(leads, "me", USER_A);
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.id, "lead-1");
  });

  it("filters unassigned leads", () => {
    const unassigned = filterLeadsByAssignee(leads, "unassigned", USER_A);
    assert.equal(unassigned.length, 1);
    assert.equal(unassigned[0]?.id, "lead-3");
  });

  it("counts assignee buckets", () => {
    assert.equal(countLeadsByAssignee(leads, "all", USER_A), 3);
    assert.equal(countLeadsByAssignee(leads, "me", USER_B), 1);
    assert.equal(countLeadsByAssignee(leads, "unassigned", USER_A), 1);
  });
});

describe("member display", () => {
  it("prefers full name over email", () => {
    assert.equal(
      formatMemberDisplayName({
        full_name: "Marco Rossi",
        email: "marco@example.com",
      }),
      "Marco Rossi"
    );
  });

  it("falls back to email local part", () => {
    assert.equal(
      formatMemberDisplayName({ full_name: null, email: "agent@agency.com" }),
      "agent"
    );
  });

  it("builds assignee labels from members", () => {
    const labels = buildMemberLabelMap([
      {
        id: "member-1",
        workspace_id: "workspace-1",
        user_id: USER_A,
        role: "owner",
        created_at: "2026-01-01T00:00:00.000Z",
        full_name: "Owner User",
        email: "owner@example.com",
      },
    ]);

    assert.equal(getAssigneeLabel(USER_A, labels), "Owner User");
    assert.equal(getAssigneeLabel(null, labels), "Unassigned");
    assert.equal(getAssigneeLabel(USER_B, labels), "Unknown member");
  });
});
