import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMetaDeliveryDiagnosis } from "@/lib/meta/message-status-debug";

describe("buildMetaDeliveryDiagnosis", () => {
  it("flags business-initiated text as the likely cause when app sends type=text", () => {
    const diagnosis = buildMetaDeliveryDiagnosis({
      phoneNumber: {
        ok: true,
        status: 200,
        data: {
          status: "CONNECTED",
          display_phone_number: "+1 555 0100",
          messaging_limit_tier: "TIER_250",
        },
      },
      waba: null,
      templates: null,
      outboundHeartbeat: {
        id: "outbound",
        instance: "123",
        last_webhook_received_at: null,
        last_message_id: "wamid.test",
        last_remote_jid: null,
        last_phone: "393471234567",
        last_direction: "outbound",
        last_processing_status: "meta_sent",
        last_error: null,
        last_response_body: null,
        last_evolution_message_id: "wamid.test",
        last_delivery_key: null,
        last_delivery_status: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      inboundHeartbeat: null,
      runtimeOutbound: {
        lastSuccess: null,
        lastFailure: null,
        recentFailures: [],
      },
      appSendType: "text",
    });

    assert.equal(diagnosis.primaryCause, "business_initiated_text_outside_24h_window");
    assert.equal(diagnosis.confidence, "high");
    assert.match(diagnosis.summary, /template/i);
  });

  it("surfaces webhook failed delivery with high confidence", () => {
    const diagnosis = buildMetaDeliveryDiagnosis({
      phoneNumber: null,
      waba: null,
      templates: null,
      outboundHeartbeat: {
        id: "outbound",
        instance: "123",
        last_webhook_received_at: null,
        last_message_id: "wamid.failed",
        last_remote_jid: null,
        last_phone: "393471234567",
        last_direction: "outbound",
        last_processing_status: "meta_delivery_update",
        last_error: "Meta reported failed delivery.",
        last_response_body: null,
        last_evolution_message_id: "wamid.failed",
        last_delivery_key: null,
        last_delivery_status: "FAILED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      inboundHeartbeat: {
        id: "inbound",
        instance: null,
        last_webhook_received_at: new Date().toISOString(),
        last_message_id: null,
        last_remote_jid: null,
        last_phone: null,
        last_direction: "inbound",
        last_processing_status: "received",
        last_error: null,
        last_response_body: null,
        last_evolution_message_id: null,
        last_delivery_key: null,
        last_delivery_status: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      runtimeOutbound: {
        lastSuccess: null,
        lastFailure: null,
        recentFailures: [],
      },
      appSendType: "text",
    });

    assert.equal(diagnosis.primaryCause, "meta_webhook_reported_failed");
    assert.equal(diagnosis.confidence, "high");
  });

  it("documents that Graph API accepted is not handset delivery", () => {
    const diagnosis = buildMetaDeliveryDiagnosis({
      phoneNumber: null,
      waba: null,
      templates: null,
      outboundHeartbeat: null,
      inboundHeartbeat: null,
      runtimeOutbound: {
        lastSuccess: null,
        lastFailure: null,
        recentFailures: [],
      },
      appSendType: "text",
    });

    const acceptanceCheck = diagnosis.checks.find(
      (check) => check.id === "graph_api_acceptance_vs_delivery"
    );
    assert.ok(acceptanceCheck);
    assert.match(acceptanceCheck.detail, /accepted/i);
  });
});

describe("Meta development mode recipient rules", () => {
  it("models Meta sandbox requiring allowed To numbers in development", () => {
    const diagnosis = buildMetaDeliveryDiagnosis({
      phoneNumber: null,
      waba: null,
      templates: null,
      outboundHeartbeat: null,
      inboundHeartbeat: null,
      runtimeOutbound: {
        lastSuccess: null,
        lastFailure: null,
        recentFailures: [],
      },
      appSendType: "text",
    });

    const devCheck = diagnosis.checks.find(
      (check) => check.id === "development_mode_recipients"
    );
    assert.ok(devCheck);
    assert.match(devCheck.detail, /Development mode/i);
  });
});
