import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPipelineChecklist,
  inferPipelineBreakingPoint,
} from "@/lib/whatsapp/pipeline-audit-logic";
import type { WhatsAppWebhookHeartbeat } from "@/types/database";

function heartbeat(partial: Partial<WhatsAppWebhookHeartbeat>): WhatsAppWebhookHeartbeat {
  return {
    id: "inbound",
    instance: "my-evolution-instance",
    last_webhook_received_at: new Date().toISOString(),
    last_message_id: "msg-1",
    last_remote_jid: "393401234567@s.whatsapp.net",
    last_phone: "393401234567",
    last_direction: "inbound",
    last_processing_status: "processed_sent",
    last_error: null,
    last_response_body: null,
    last_evolution_message_id: null,
    last_delivery_key: null,
    last_delivery_status: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("inferPipelineBreakingPoint", () => {
  it("flags provider channel mismatch when Evolution inbound and Meta primary outbound", () => {
    const result = inferPipelineBreakingPoint({
      evolutionConfigured: true,
      metaConfigured: true,
      primaryOutbound: "meta",
      connectionState: "open",
      webhookUrlMatches: true,
      webhookEnabled: true,
      inboundHeartbeat: heartbeat({
        last_processing_status: "processed_sent",
        instance: "evolution-prod",
      }),
      outboundHeartbeat: null,
      lastProcessedAt: new Date().toISOString(),
      lastClientConversationAt: new Date().toISOString(),
      lastAiConversationAt: new Date().toISOString(),
      tenantRoutingConfigured: true,
      runtimeLastFailureReason: null,
    });

    assert.equal(result.breakingPoint.step, "provider_channel_mismatch");
    assert.match(result.whyNoReply, /Evolution/i);
  });

  it("flags evolution instance not connected", () => {
    const result = inferPipelineBreakingPoint({
      evolutionConfigured: true,
      metaConfigured: false,
      primaryOutbound: "evolution",
      connectionState: "close",
      webhookUrlMatches: true,
      webhookEnabled: true,
      inboundHeartbeat: null,
      outboundHeartbeat: null,
      lastProcessedAt: null,
      lastClientConversationAt: null,
      lastAiConversationAt: null,
      tenantRoutingConfigured: true,
      runtimeLastFailureReason: null,
    });

    assert.equal(result.breakingPoint.step, "evolution_instance_not_connected");
  });

  it("flags webhook unauthorized", () => {
    const result = inferPipelineBreakingPoint({
      evolutionConfigured: true,
      metaConfigured: false,
      primaryOutbound: "evolution",
      connectionState: "open",
      webhookUrlMatches: true,
      webhookEnabled: true,
      inboundHeartbeat: heartbeat({
        last_processing_status: "unauthorized",
        last_error: "Unauthorized webhook request.",
      }),
      outboundHeartbeat: null,
      lastProcessedAt: null,
      lastClientConversationAt: null,
      lastAiConversationAt: null,
      tenantRoutingConfigured: true,
      runtimeLastFailureReason: null,
    });

    assert.equal(result.breakingPoint.step, "webhook_unauthorized");
  });
});

describe("buildPipelineChecklist", () => {
  it("marks outbound attempted when processed_sent", () => {
    const { checklist } = buildPipelineChecklist({
      evolutionConfigured: true,
      connectionState: "open",
      webhookUrlMatches: true,
      inboundHeartbeat: heartbeat({ last_processing_status: "processed_sent" }),
      lastProcessedAt: new Date().toISOString(),
      lastClientConversationAt: new Date().toISOString(),
      lastAiConversationAt: new Date().toISOString(),
      primaryOutbound: "meta",
      outboundHeartbeat: null,
      runtimeOutboundSent: true,
      inboundStatus: "processed_sent",
    });

    assert.equal(checklist.outboundSendAttempted, true);
    assert.equal(checklist.outboundProvider, "meta");
  });
});
