import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLeadInboxSearchHaystack,
  formatInboxMessagePreview,
  formatInboxSenderLabel,
  formatUnreadBadgeCount,
  leadMatchesInboxSearch,
  shouldShowUnreadBadge,
} from "@/lib/leads/inbox-display";
import { buildLeadsScopeBeforeStatusFilter } from "@/lib/leads/leads-list-filters";
import type { LeadForInbox } from "@/types/database";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function inboxLead(overrides: Partial<LeadForInbox> = {}): LeadForInbox {
  return {
    id: "lead-1",
    user_id: USER_A,
    assigned_user_id: null,
    workspace_id: "ws-1",
    client_name: "Maria Silva",
    phone: "+351 912 345 678",
    phone_normalized: "351912345678",
    interest: "3-bed apartment",
    status: "new",
    budget: null,
    preferred_area: null,
    property_type: null,
    timeline: null,
    intent_status: null,
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: "pt",
    pending_property_offer: null,
    last_message_text: "Is the listing still available?",
    last_message_sender: "client",
    last_message_at: "2026-05-20T12:00:00.000Z",
    created_at: "2026-05-19T10:00:00.000Z",
    unread_count: 2,
    ...overrides,
  };
}

describe("inbox display helpers", () => {
  it("formats sender labels for inbox cards", () => {
    assert.equal(formatInboxSenderLabel("client"), "Client");
    assert.equal(formatInboxSenderLabel("ai"), "AI");
    assert.equal(formatInboxSenderLabel("agent"), "You");
    assert.equal(formatInboxSenderLabel(null), null);
  });

  it("shows message preview text on cards", () => {
    assert.equal(
      formatInboxMessagePreview("Hello there"),
      "Hello there"
    );
    assert.equal(formatInboxMessagePreview("  "), "No messages yet");
    assert.equal(formatInboxMessagePreview(null), "No messages yet");
  });

  it("shows unread badge when unread_count > 0", () => {
    assert.equal(shouldShowUnreadBadge(1), true);
    assert.equal(shouldShowUnreadBadge(3), true);
    assert.equal(formatUnreadBadgeCount(3), "3");
  });

  it("hides unread badge when unread_count is 0", () => {
    assert.equal(shouldShowUnreadBadge(0), false);
    assert.equal(formatUnreadBadgeCount(0), "");
  });

  it("caps unread badge at 99+", () => {
    assert.equal(formatUnreadBadgeCount(120), "99+");
  });

  it("search finds last_message_text", () => {
    const lead = inboxLead({
      last_message_text: "Can we visit Saturday morning?",
    });

    assert.equal(
      leadMatchesInboxSearch(lead, "Unassigned", "saturday morning"),
      true
    );
    assert.equal(
      leadMatchesInboxSearch(lead, "Unassigned", "no match here"),
      false
    );
  });

  it("search haystack includes assignee label, phone, interest, and status", () => {
    const lead = inboxLead({
      status: "qualified",
      interest: "Penthouse",
      phone: "+39 333 111 2222",
    });
    const haystack = buildLeadInboxSearchHaystack(lead, "Alex Agent");

    assert.match(haystack, /qualified/);
    assert.match(haystack, /penthouse/);
    assert.match(haystack, /333 111 2222/);
    assert.match(haystack, /alex agent/);
  });
});

describe("inbox item shape with existing filters", () => {
  it("pipeline and assignee filters work on LeadForInbox rows", () => {
    const leads: LeadForInbox[] = [
      inboxLead({
        id: "mine",
        status: "scheduled",
        assigned_user_id: USER_A,
        unread_count: 1,
      }),
      inboxLead({
        id: "open",
        status: "qualified",
        assigned_user_id: null,
        unread_count: 0,
      }),
      inboxLead({
        id: "new",
        status: "new",
        unread_count: 4,
      }),
    ];

    const scoped = buildLeadsScopeBeforeStatusFilter(leads, {
      assigneeFilter: "me",
      pipeline: "qualified",
      currentUserId: USER_A,
    });

    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, "mine");
    assert.equal(scoped[0]?.unread_count, 1);
  });
});
