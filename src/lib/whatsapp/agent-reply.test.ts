import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  isAcceptableAgentWhatsAppSendResult,
  sendAgentWhatsAppReply,
  usesAgentWhatsAppOutbound,
} from "@/lib/whatsapp/agent-reply";
import type { WhatsAppSendResult } from "@/lib/whatsapp/types";
import type { Conversation, Lead } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const LEAD_ID = "11111111-1111-1111-1111-111111111111";
const WORKSPACE_ID = "22222222-2222-2222-2222-222222222222";

function buildLead(
  overrides: Partial<
    Pick<Lead, "phone" | "phone_normalized" | "workspace_id">
  > = {}
): Lead {
  return {
    id: LEAD_ID,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    assigned_user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    workspace_id: WORKSPACE_ID,
    client_name: "Marco Rossi",
    phone: "+39 333 123 4567",
    phone_normalized: "393331234567",
    interest: "Apartment in Florence",
    status: "new",
    budget: null,
    preferred_area: null,
    property_type: null,
    timeline: null,
    intent_status: null,
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: "it",
    pending_property_offer: null,
    created_at: "2026-05-10T10:00:00.000Z",
    ...overrides,
  };
}

const savedConversation: Conversation = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  lead_id: LEAD_ID,
  workspace_id: WORKSPACE_ID,
  message: "Hello from the agent",
  sender: "agent",
  created_at: "2026-05-15T12:00:00.000Z",
};

const supabase = {} as SupabaseClient<Database>;

function confirmedSendResult(
  overrides: Partial<WhatsAppSendResult> = {}
): WhatsAppSendResult {
  return {
    success: true,
    status: 201,
    sentToWhatsApp: true,
    pendingOnly: false,
    ...overrides,
  };
}

function pendingSendResult(
  overrides: Partial<WhatsAppSendResult> = {}
): WhatsAppSendResult {
  return {
    success: true,
    status: 201,
    sentToWhatsApp: false,
    pendingOnly: true,
    deliveryStatus: "PENDING",
    warning:
      "Evolution returned HTTP 201 with status PENDING — message is NOT confirmed delivered to WhatsApp.",
    ...overrides,
  };
}

describe("isAcceptableAgentWhatsAppSendResult", () => {
  it("accepts confirmed delivery", () => {
    assert.equal(isAcceptableAgentWhatsAppSendResult(confirmedSendResult()), true);
  });

  it("accepts Evolution PENDING when HTTP send succeeded", () => {
    assert.equal(isAcceptableAgentWhatsAppSendResult(pendingSendResult()), true);
  });

  it("rejects failed sends", () => {
    assert.equal(
      isAcceptableAgentWhatsAppSendResult({
        success: false,
        error: "Evolution API request failed (500)",
      }),
      false
    );
  });

  it("rejects success without confirmed or pending-only acceptance", () => {
    assert.equal(
      isAcceptableAgentWhatsAppSendResult({
        success: true,
        sentToWhatsApp: false,
        pendingOnly: false,
      }),
      false
    );
  });
});

describe("usesAgentWhatsAppOutbound", () => {
  it("routes only agent sender through WhatsApp outbound", () => {
    assert.equal(usesAgentWhatsAppOutbound("agent"), true);
    assert.equal(usesAgentWhatsAppOutbound("client"), false);
    assert.equal(usesAgentWhatsAppOutbound("ai"), false);
  });
});

describe("sendAgentWhatsAppReply", () => {
  it("sends WhatsApp then creates one agent conversation row on confirmed delivery", async () => {
    let sendCalls = 0;
    let createCalls = 0;

    const result = await sendAgentWhatsAppReply(
      supabase,
      buildLead(),
      "Hello from the agent",
      {
        sendWhatsAppTextSafe: async (phoneDigits, text) => {
          sendCalls += 1;
          assert.equal(phoneDigits, "393331234567");
          assert.equal(text, "Hello from the agent");
          return confirmedSendResult({ status: 200 });
        },
        createConversation: async (_client, input) => {
          createCalls += 1;
          assert.equal(input.lead_id, LEAD_ID);
          assert.equal(input.workspace_id, WORKSPACE_ID);
          assert.equal(input.message, "Hello from the agent");
          assert.equal(input.sender, "agent");
          return savedConversation;
        },
      }
    );

    assert.equal(sendCalls, 1);
    assert.equal(createCalls, 1);
    assert.equal(result.conversation, savedConversation);
  });

  it("persists conversation when Evolution returns PENDING and logs a warning", async () => {
    let createCalls = 0;
    const warnMock = mock.method(console, "warn", () => {});

    try {
      await sendAgentWhatsAppReply(supabase, buildLead(), "Pending but sent", {
        sendWhatsAppTextSafe: async () => pendingSendResult(),
        createConversation: async (_client, input) => {
          createCalls += 1;
          assert.equal(input.workspace_id, WORKSPACE_ID);
          assert.equal(input.sender, "agent");
          return {
            ...savedConversation,
            message: input.message,
          };
        },
      });

      assert.equal(createCalls, 1);
      assert.equal(warnMock.mock.callCount(), 1);
      assert.match(String(warnMock.mock.calls[0]?.arguments[0]), /PENDING delivery status/);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("persists workspace_id on the agent conversation row", async () => {
    await sendAgentWhatsAppReply(supabase, buildLead(), "Workspace scoped", {
      sendWhatsAppTextSafe: async () => confirmedSendResult(),
      createConversation: async (_client, input) => {
        assert.equal(input.workspace_id, WORKSPACE_ID);
        return {
          ...savedConversation,
          message: input.message,
          workspace_id: input.workspace_id ?? null,
        };
      },
    });
  });

  it("throws when workspace_id is missing and does not send WhatsApp or create a row", async () => {
    let sendCalls = 0;
    let createCalls = 0;

    await assert.rejects(
      () =>
        sendAgentWhatsAppReply(
          supabase,
          buildLead({ workspace_id: null }),
          "Hello",
          {
            sendWhatsAppTextSafe: async () => {
              sendCalls += 1;
              return confirmedSendResult();
            },
            createConversation: async () => {
              createCalls += 1;
              return savedConversation;
            },
          }
        ),
      /not associated with a workspace/
    );

    assert.equal(sendCalls, 0);
    assert.equal(createCalls, 0);
  });

  it("throws when the lead has no phone and does not create a conversation", async () => {
    let sendCalls = 0;
    let createCalls = 0;

    await assert.rejects(
      () =>
        sendAgentWhatsAppReply(
          supabase,
          buildLead({ phone: null, phone_normalized: null }),
          "Hello",
          {
            sendWhatsAppTextSafe: async () => {
              sendCalls += 1;
              return confirmedSendResult();
            },
            createConversation: async () => {
              createCalls += 1;
              return savedConversation;
            },
          }
        ),
      /no phone number/
    );

    assert.equal(sendCalls, 0);
    assert.equal(createCalls, 0);
  });

  it("throws when WhatsApp send fails and does not create a conversation", async () => {
    let sendCalls = 0;
    let createCalls = 0;

    await assert.rejects(
      () =>
        sendAgentWhatsAppReply(supabase, buildLead(), "Hello", {
          sendWhatsAppTextSafe: async () => {
            sendCalls += 1;
            return {
              success: false,
              error: "WhatsApp provider unavailable",
            };
          },
          createConversation: async () => {
            createCalls += 1;
            return savedConversation;
          },
        }),
      /WhatsApp provider unavailable/
    );

    assert.equal(sendCalls, 1);
    assert.equal(createCalls, 0);
  });

  it("does not duplicate conversation rows on success", async () => {
    let createCalls = 0;

    await sendAgentWhatsAppReply(supabase, buildLead(), "One message only", {
      sendWhatsAppTextSafe: async () => confirmedSendResult(),
      createConversation: async () => {
        createCalls += 1;
        return savedConversation;
      },
    });

    assert.equal(createCalls, 1);
  });
});
