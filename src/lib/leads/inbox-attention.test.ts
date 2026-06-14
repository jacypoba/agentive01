import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeInboxQueueCounts,
  filterLeadsByInboxQueue,
  filterLeadsByUnread,
  formatNavLeadsLabel,
  leadNeedsAttentionFromConversations,
  type ConversationAttentionMessage,
} from "@/lib/leads/inbox-attention";
import type { LeadForInbox } from "@/types/database";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function msg(
  sender: ConversationAttentionMessage["sender"],
  created_at: string
): ConversationAttentionMessage {
  return { sender, created_at };
}

function inboxLead(overrides: Partial<LeadForInbox> = {}): LeadForInbox {
  return {
    id: "lead-1",
    user_id: USER_A,
    assigned_user_id: null,
    workspace_id: "ws-1",
    client_name: "Maria",
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
    created_at: "2026-05-20T10:00:00.000Z",
    unread_count: 0,
    needs_attention: false,
    ...overrides,
  };
}

describe("leadNeedsAttentionFromConversations", () => {
  it("client message without reply needs attention", () => {
    assert.equal(
      leadNeedsAttentionFromConversations([
        msg("client", "2026-05-20T10:00:00.000Z"),
      ]),
      true
    );
  });

  it("agent reply clears attention", () => {
    assert.equal(
      leadNeedsAttentionFromConversations([
        msg("client", "2026-05-20T10:00:00.000Z"),
        msg("agent", "2026-05-20T10:05:00.000Z"),
      ]),
      false
    );
  });

  it("AI reply clears attention", () => {
    assert.equal(
      leadNeedsAttentionFromConversations([
        msg("client", "2026-05-20T10:00:00.000Z"),
        msg("ai", "2026-05-20T10:05:00.000Z"),
      ]),
      false
    );
  });

  it("handles mixed conversation histories", () => {
    assert.equal(
      leadNeedsAttentionFromConversations([
        msg("client", "2026-05-20T09:00:00.000Z"),
        msg("ai", "2026-05-20T09:05:00.000Z"),
        msg("client", "2026-05-20T10:00:00.000Z"),
      ]),
      true
    );

    assert.equal(
      leadNeedsAttentionFromConversations([
        msg("client", "2026-05-20T09:00:00.000Z"),
        msg("ai", "2026-05-20T09:05:00.000Z"),
        msg("client", "2026-05-20T10:00:00.000Z"),
        msg("agent", "2026-05-20T10:05:00.000Z"),
      ]),
      false
    );

    assert.equal(
      leadNeedsAttentionFromConversations([
        msg("agent", "2026-05-20T09:00:00.000Z"),
        msg("client", "2026-05-20T10:00:00.000Z"),
      ]),
      true
    );
  });

  it("returns false when there are no client messages", () => {
    assert.equal(
      leadNeedsAttentionFromConversations([
        msg("ai", "2026-05-20T10:00:00.000Z"),
      ]),
      false
    );
  });
});

describe("inbox queue filters", () => {
  const leads: LeadForInbox[] = [
    inboxLead({
      id: "unread-attention",
      unread_count: 2,
      needs_attention: true,
    }),
    inboxLead({
      id: "read-attention",
      unread_count: 0,
      needs_attention: true,
      assigned_user_id: USER_A,
      status: "qualified",
    }),
    inboxLead({
      id: "mine-clear",
      unread_count: 0,
      needs_attention: false,
      assigned_user_id: USER_A,
      status: "qualified",
    }),
    inboxLead({
      id: "unassigned-unread",
      unread_count: 1,
      needs_attention: false,
      status: "scheduled",
    }),
  ];

  it("unread filter keeps only unread leads", () => {
    const unread = filterLeadsByUnread(leads);
    assert.deepEqual(
      unread.map((lead) => lead.id),
      ["unread-attention", "unassigned-unread"]
    );
  });

  it("needs attention filter keeps waiting client threads", () => {
    const waiting = filterLeadsByInboxQueue(leads, "needs_attention", USER_A);
    assert.deepEqual(
      waiting.map((lead) => lead.id),
      ["unread-attention", "read-attention"]
    );
  });

  it("computes badge counts within pipeline scope", () => {
    const counts = computeInboxQueueCounts(leads, {
      currentUserId: USER_A,
      pipeline: "qualified",
    });

    assert.equal(counts.all, 3);
    assert.equal(counts.unread, 1);
    assert.equal(counts.needs_attention, 1);
    assert.equal(counts.me, 2);
    assert.equal(counts.unassigned, 1);
  });

  it("computes workspace-wide counts without pipeline filter", () => {
    const counts = computeInboxQueueCounts(leads, {
      currentUserId: USER_A,
    });

    assert.equal(counts.all, 4);
    assert.equal(counts.unread, 2);
    assert.equal(counts.needs_attention, 2);
    assert.equal(counts.me, 2);
    assert.equal(counts.unassigned, 2);
  });
});

describe("formatNavLeadsLabel", () => {
  it("shows needs attention count in navigation label", () => {
    assert.equal(formatNavLeadsLabel(3), "Leads (3)");
    assert.equal(formatNavLeadsLabel(0), "Leads");
  });
});
