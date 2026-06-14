import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLeadInboxItems,
  buildReadsByLeadIdMap,
  compareLeadsForInbox,
  countUnreadClientMessages,
  getLeadsForInbox,
  groupClientMessagesByLeadId,
  markLeadConversationRead,
  sortLeadsForInbox,
} from "@/lib/data/inbox";
import type { Lead, LeadConversationRead } from "@/types/database";

const WORKSPACE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeLead(
  id: string,
  overrides: Partial<Lead> = {}
): Lead {
  return {
    id,
    user_id: USER_ID,
    assigned_user_id: null,
    workspace_id: WORKSPACE_ID,
    client_name: `Lead ${id}`,
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
    created_at: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("inbox ordering helpers", () => {
  it("sorts by last_message_at desc with nulls last", () => {
    const leads = sortLeadsForInbox([
      makeLead("no-message", { created_at: "2026-05-03T10:00:00.000Z" }),
      makeLead("older", {
        last_message_at: "2026-05-01T12:00:00.000Z",
        created_at: "2026-05-01T10:00:00.000Z",
      }),
      makeLead("newer", {
        last_message_at: "2026-05-02T12:00:00.000Z",
        created_at: "2026-05-02T10:00:00.000Z",
      }),
    ]);

    assert.deepEqual(
      leads.map((lead) => lead.id),
      ["newer", "older", "no-message"]
    );
  });

  it("breaks ties on last_message_at with created_at desc", () => {
    const sameMessageTime = "2026-05-02T12:00:00.000Z";
    const a = makeLead("a", {
      last_message_at: sameMessageTime,
      created_at: "2026-05-01T10:00:00.000Z",
    });
    const b = makeLead("b", {
      last_message_at: sameMessageTime,
      created_at: "2026-05-03T10:00:00.000Z",
    });

    assert.equal(compareLeadsForInbox(b, a), -1);
    assert.deepEqual(sortLeadsForInbox([a, b]).map((lead) => lead.id), [
      "b",
      "a",
    ]);
  });
});

describe("inbox unread helpers", () => {
  const clientMessages = [
    { created_at: "2026-05-01T10:00:00.000Z" },
    { created_at: "2026-05-01T11:00:00.000Z" },
    { created_at: "2026-05-01T12:00:00.000Z" },
  ];

  it("counts all client messages when there is no read row", () => {
    assert.equal(countUnreadClientMessages(clientMessages, null), 3);
    assert.equal(countUnreadClientMessages(clientMessages, undefined), 3);
  });

  it("counts only client messages after last_read_at", () => {
    assert.equal(
      countUnreadClientMessages(clientMessages, "2026-05-01T10:00:00.000Z"),
      2
    );
    assert.equal(
      countUnreadClientMessages(clientMessages, "2026-05-01T12:00:00.000Z"),
      0
    );
  });

  it("builds inbox items with unread_count from grouped client messages", () => {
    const leadA = makeLead("lead-a");
    const leadB = makeLead("lead-b");
    const readsByLeadId = buildReadsByLeadIdMap([
      {
        lead_id: "lead-a",
        last_read_at: "2026-05-01T10:00:00.000Z",
      },
    ]);
    const clientMessagesByLeadId = groupClientMessagesByLeadId([
      { lead_id: "lead-a", created_at: "2026-05-01T09:00:00.000Z" },
      { lead_id: "lead-a", created_at: "2026-05-01T11:00:00.000Z" },
      { lead_id: "lead-b", created_at: "2026-05-01T08:00:00.000Z" },
    ]);

    const items = buildLeadInboxItems(
      [leadA, leadB],
      readsByLeadId,
      clientMessagesByLeadId
    );

    assert.equal(items[0]?.unread_count, 1);
    assert.equal(items[1]?.unread_count, 1);
  });

  it("excludes non-client messages because only client rows are grouped", () => {
    const lead = makeLead("lead-a");
    const items = buildLeadInboxItems(
      [lead],
      new Map(),
      groupClientMessagesByLeadId([
        { lead_id: "lead-a", created_at: "2026-05-01T10:00:00.000Z" },
      ])
    );

    assert.equal(items[0]?.unread_count, 1);
  });
});

describe("getLeadsForInbox", () => {
  it("returns leads with preview fields and unread_count", async () => {
    const leadNewer = makeLead("lead-newer", {
      last_message_text: "Latest",
      last_message_sender: "client",
      last_message_at: "2026-05-02T12:00:00.000Z",
    });
    const leadOlder = makeLead("lead-older", {
      last_message_text: "Older",
      last_message_sender: "agent",
      last_message_at: "2026-05-01T12:00:00.000Z",
    });

    const supabase = {
      from(table: string) {
        if (table === "leads") {
          return {
            select: () => ({
              eq: () => ({
                order: (_col: string, _opts?: unknown) => ({
                  order: () =>
                    Promise.resolve({ data: [leadNewer, leadOlder], error: null }),
                }),
              }),
            }),
          };
        }

        if (table === "lead_conversation_reads") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        lead_id: "lead-newer",
                        last_read_at: "2026-05-02T12:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }

        if (table === "conversations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        lead_id: "lead-newer",
                        created_at: "2026-05-02T11:00:00.000Z",
                      },
                      {
                        lead_id: "lead-newer",
                        created_at: "2026-05-02T13:00:00.000Z",
                      },
                      {
                        lead_id: "lead-older",
                        created_at: "2026-05-01T13:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const items = await getLeadsForInbox(
      supabase as never,
      WORKSPACE_ID,
      USER_ID
    );

    assert.equal(items.length, 2);
    assert.equal(items[0]?.id, "lead-newer");
    assert.equal(items[0]?.last_message_text, "Latest");
    assert.equal(items[0]?.unread_count, 1);
    assert.equal(items[1]?.unread_count, 1);
  });
});

describe("markLeadConversationRead", () => {
  it("upserts a read row for the current user", async () => {
    const readAt = "2026-05-02T15:00:00.000Z";
    let upsertPayload: Record<string, unknown> | null = null;

    const supabase = {
      from() {
        return {
          upsert(payload: Record<string, unknown>) {
            upsertPayload = payload;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: "read-1",
                      workspace_id: WORKSPACE_ID,
                      lead_id: "lead-1",
                      user_id: USER_ID,
                      last_read_at: readAt,
                      created_at: readAt,
                      updated_at: readAt,
                    } satisfies LeadConversationRead,
                    error: null,
                  }),
              }),
            };
          },
        };
      },
    };

    const row = await markLeadConversationRead(
      supabase as never,
      WORKSPACE_ID,
      "lead-1",
      USER_ID,
      readAt
    );

    assert.equal(row.lead_id, "lead-1");
    assert.deepEqual(upsertPayload, {
      workspace_id: WORKSPACE_ID,
      lead_id: "lead-1",
      user_id: USER_ID,
      last_read_at: readAt,
      updated_at: readAt,
    });
  });
});
