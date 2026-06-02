import { getMetaInstanceId } from "@/lib/whatsapp/config";
import type { WhatsAppWebhookHeartbeat } from "@/types/database";

export type PipelineCheckAnswer = boolean | "unknown" | "partial";

export type PipelineChecklist = {
  evolutionInboundReachingInstance: PipelineCheckAnswer;
  evolutionForwardingWebhookToAgentive01: PipelineCheckAnswer;
  agentive01ReceivingWebhook: PipelineCheckAnswer;
  inboundStoredInSupabase: PipelineCheckAnswer;
  aiPipelineTriggered: PipelineCheckAnswer;
  openAiReplyGenerated: PipelineCheckAnswer;
  outboundSendAttempted: PipelineCheckAnswer;
  outboundProvider: "meta" | "evolution" | "none" | "unknown";
  userReceivesReply: PipelineCheckAnswer;
};

export type PipelineBreakingPoint = {
  step:
    | "evolution_instance_not_connected"
    | "evolution_webhook_not_configured"
    | "evolution_webhook_not_forwarding"
    | "webhook_unauthorized"
    | "webhook_parse_skipped"
    | "duplicate_message"
    | "tenant_routing_missing"
    | "billing_or_lead_limit"
    | "inbound_processing_error"
    | "ai_no_outbound_messages"
    | "outbound_send_failed"
    | "provider_channel_mismatch"
    | "outbound_pending_not_delivered"
    | "none_observed";
  summary: string;
  confidence: "high" | "medium" | "low";
};

const RECENT_WEBHOOK_MS = 15 * 60 * 1000;

function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= RECENT_WEBHOOK_MS;
}

function inferOutboundProviderFromHeartbeat(
  heartbeat: WhatsAppWebhookHeartbeat | null
): "meta" | "evolution" | "none" | "unknown" {
  const status = heartbeat?.last_processing_status ?? "";
  if (status.startsWith("meta")) return "meta";
  if (
    status.includes("evolution") ||
    status === "sent" ||
    status === "delivered" ||
    heartbeat?.last_evolution_message_id
  ) {
    return "evolution";
  }
  return heartbeat ? "unknown" : "none";
}

export function inferPipelineBreakingPoint(input: {
  evolutionConfigured: boolean;
  metaConfigured: boolean;
  primaryOutbound: "meta" | "evolution" | null;
  connectionState: string | null;
  webhookUrlMatches: boolean | null;
  webhookEnabled: boolean | null;
  inboundHeartbeat: WhatsAppWebhookHeartbeat | null;
  outboundHeartbeat: WhatsAppWebhookHeartbeat | null;
  lastProcessedAt: string | null;
  lastClientConversationAt: string | null;
  lastAiConversationAt: string | null;
  tenantRoutingConfigured: boolean;
  runtimeLastFailureReason: string | null;
}): { breakingPoint: PipelineBreakingPoint; whyNoReply: string; recommendedFix: string[] } {
  const inboundStatus = input.inboundHeartbeat?.last_processing_status ?? null;
  const inboundError = input.inboundHeartbeat?.last_error ?? null;
  const recentWebhook = isRecent(input.inboundHeartbeat?.last_webhook_received_at);
  const metaInstanceId = getMetaInstanceId();
  const inboundInstance = input.inboundHeartbeat?.instance ?? null;
  const inboundViaEvolution =
    Boolean(inboundInstance) && inboundInstance !== metaInstanceId;

  if (input.evolutionConfigured) {
    const state = (input.connectionState ?? "").toLowerCase();
    if (state && state !== "open") {
      return {
        breakingPoint: {
          step: "evolution_instance_not_connected",
          summary: `Evolution instance is not connected (state=${input.connectionState}). Inbound WhatsApp will not reach the bot.`,
          confidence: "high",
        },
        whyNoReply:
          "The business number is tied to Evolution, but the Baileys session is not open — messages never enter the pipeline.",
        recommendedFix: [
          "Open Evolution Manager / Railway and reconnect the instance until connectionState is open.",
          "Scan QR or restore session for +39 379 378 7910, then send a test message again.",
        ],
      };
    }

    if (input.webhookEnabled === false || input.webhookUrlMatches === false) {
      return {
        breakingPoint: {
          step: "evolution_webhook_not_configured",
          summary:
            "Evolution webhook URL does not match Agentive01 or webhooks are disabled — Agentive01 never receives inbound events.",
          confidence: "high",
        },
        whyNoReply:
          "Evolution is connected on the handset side, but it is not POSTing message events to your Vercel webhook.",
        recommendedFix: [
          `Set Evolution webhook to the expected URL (see evolution.expectedWebhookUrl in this audit).`,
          "Enable webhook events including MESSAGES_UPSERT / messages.upsert.",
          "Confirm EVOLUTION_WEBHOOK_SECRET or apikey auth matches production env.",
        ],
      };
    }

    if (!recentWebhook) {
      return {
        breakingPoint: {
          step: "evolution_webhook_not_forwarding",
          summary:
            "No recent inbound webhook recorded in Supabase — Evolution is likely not forwarding POSTs to Agentive01.",
          confidence: inboundStatus ? "medium" : "high",
        },
        whyNoReply:
          "Either Evolution did not receive the message, or it did not forward a webhook to /api/webhooks/evolution.",
        recommendedFix: [
          "Send a test from your personal number to the business number, then re-run this audit.",
          "Check Evolution logs for webhook delivery errors to your Vercel URL.",
          "Verify NEXT_PUBLIC_APP_URL matches the domain configured in Evolution.",
        ],
      };
    }
  }

  if (inboundStatus === "unauthorized") {
    return {
      breakingPoint: {
        step: "webhook_unauthorized",
        summary: "Evolution webhook reached Agentive01 but was rejected (401).",
        confidence: "high",
      },
      whyNoReply: "Inbound POST failed auth — processing never started.",
      recommendedFix: [
        "Align EVOLUTION_API_KEY with Evolution webhook apikey header or set EVOLUTION_WEBHOOK_SECRET query param.",
      ],
    };
  }

  if (inboundStatus === "skipped") {
    return {
      breakingPoint: {
        step: "webhook_parse_skipped",
        summary:
          "Webhook received but parseEvolutionWebhook returned null (wrong event, fromMe, group, or non-text).",
        confidence: "high",
      },
      whyNoReply:
        "Agentive01 ignored the payload — only individual chats with extractable text on messages.upsert are processed.",
      recommendedFix: [
        "Send a plain text DM (not group/status). Ensure event is messages.upsert, not only messages.update.",
      ],
    };
  }

  if (inboundStatus === "duplicate") {
    return {
      breakingPoint: {
        step: "duplicate_message",
        summary: "Message was deduplicated — already processed (processed_whatsapp_messages).",
        confidence: "high",
      },
      whyNoReply:
        "This message id was already claimed; no second reply is sent. Check if an earlier attempt failed outbound.",
      recommendedFix: [
        "Send a new test message with a fresh message id, or inspect last outbound heartbeat for the original attempt.",
      ],
    };
  }

  if (inboundStatus === "error" && inboundError) {
    const tenant =
      /workspace mapped|WHATSAPP_DEFAULT_USER_ID|tenant routing/i.test(inboundError);
    const billing = /subscription|lead limit|plan/i.test(inboundError);

    if (tenant) {
      return {
        breakingPoint: {
          step: "tenant_routing_missing",
          summary: inboundError,
          confidence: "high",
        },
        whyNoReply: "Inbound reached Agentive01 but tenant routing failed before AI.",
        recommendedFix: [
          "Add workspace_whatsapp_connections for provider=evolution and your EVOLUTION_INSTANCE_NAME.",
          "Or set WHATSAPP_DEFAULT_USER_ID to a valid workspace owner user id.",
        ],
      };
    }

    if (billing) {
      return {
        breakingPoint: {
          step: "billing_or_lead_limit",
          summary: inboundError,
          confidence: "high",
        },
        whyNoReply: "Lead creation blocked by billing/plan limits.",
        recommendedFix: ["Activate subscription or upgrade plan; check assertCanCreateLead errors in logs."],
      };
    }

    return {
      breakingPoint: {
        step: "inbound_processing_error",
        summary: inboundError,
        confidence: "high",
      },
      whyNoReply: "Processing threw before or during AI/outbound.",
      recommendedFix: ["Inspect Vercel function logs for the exact stack trace on /api/webhooks/evolution."],
    };
  }

  if (
    input.primaryOutbound === "meta" &&
    inboundViaEvolution &&
    recentWebhook &&
    (inboundStatus === "processed" || inboundStatus === "processed_sent")
  ) {
    return {
      breakingPoint: {
        step: "provider_channel_mismatch",
        summary:
          "Inbound arrives on Evolution, but outbound primary provider is Meta Cloud API — replies may not return on the Evolution-linked business number.",
        confidence: "high",
      },
      whyNoReply:
        "User messages the Evolution/Baileys business line (+39 379 378 7910), while Agentive01 sends replies via Meta Graph API (different channel).",
      recommendedFix: [
        "For Evolution-only business number: set WHATSAPP_PROVIDER=evolution (and ensure Meta is not chosen in auto mode), OR migrate inbound to Meta Cloud on the same WABA number.",
        "Until aligned, outbound will not traverse the Evolution session the user messaged.",
        "Re-test with WHATSAPP_PROVIDER=evolution after confirming Evolution session is open.",
      ],
    };
  }

  if (inboundStatus === "processed") {
    if (
      input.lastClientConversationAt &&
      (!input.lastAiConversationAt ||
        Date.parse(input.lastAiConversationAt) <
          Date.parse(input.lastClientConversationAt))
    ) {
      return {
        breakingPoint: {
          step: "ai_no_outbound_messages",
          summary:
            "Inbound processed; client message stored but no AI outbound rows (guardrails, thanks/closing skip, or zero outboundMessages).",
          confidence: "medium",
        },
        whyNoReply: "AI pipeline ran but produced nothing to send on WhatsApp.",
        recommendedFix: [
          "Check conversations table for the lead — client row without following ai sender.",
          "Review intent/guardrails in conversation-service for the message text.",
        ],
      };
    }
  }

  if (inboundStatus === "processed" && input.runtimeLastFailureReason) {
    return {
      breakingPoint: {
        step: "ai_no_outbound_messages",
        summary: `Processed without sent flag; runtime outbound failure: ${input.runtimeLastFailureReason}`,
        confidence: "medium",
      },
      whyNoReply: "AI may have run but WhatsApp outbound was not confirmed sent.",
      recommendedFix: ["See runtimeOutbound.lastFailure in this audit."],
    };
  }

  if (inboundStatus === "processed_sent") {
    const outboundStatus = input.outboundHeartbeat?.last_delivery_status ?? null;
    const pending =
      input.runtimeLastFailureReason?.toLowerCase().includes("pending") ||
      outboundStatus === "PENDING";

    if (pending) {
      return {
        breakingPoint: {
          step: "outbound_pending_not_delivered",
          summary: "Outbound accepted as PENDING on Evolution — Baileys never ACKed to handset.",
          confidence: "high",
        },
        whyNoReply: "Send returned 201/PENDING but message never left the zombie/disconnected session.",
        recommendedFix: [
          "Run /api/debug/evolution-outbound-audit and reconnect the instance.",
          "Restart Evolution container; avoid Meta Cloud integration on same instance if using Baileys.",
        ],
      };
    }

    if (input.primaryOutbound === "meta" && outboundStatus === "FAILED") {
      return {
        breakingPoint: {
          step: "outbound_send_failed",
          summary: "Meta accepted or failed delivery per webhook — user may not see handset message.",
          confidence: "medium",
        },
        whyNoReply: "Meta outbound path failed delivery (template/window/recipient).",
        recommendedFix: [
          "Use /api/debug/meta-message-status for wamid correlation.",
          "For cold outbound use approved templates; verify recipient is on Meta test list in dev.",
        ],
      };
    }
  }

  if (inboundStatus === "processed_sent") {
    return {
      breakingPoint: {
        step: "none_observed",
        summary: "Pipeline shows processed_sent — if user still sees no reply, check wrong number or client-side WhatsApp.",
        confidence: "low",
      },
      whyNoReply:
        "Server believes at least one outbound message was sent. Verify the user is messaging the same business line and checking the correct chat.",
      recommendedFix: [
        "Confirm personal number matches last inbound heartbeat phone.",
        "Compare outbound heartbeat destination with inbound phone.",
      ],
    };
  }

  if (!input.tenantRoutingConfigured && input.evolutionConfigured) {
    return {
      breakingPoint: {
        step: "tenant_routing_missing",
        summary: "No workspace_whatsapp_connections row and no WHATSAPP_DEFAULT_USER_ID — next inbound will fail.",
        confidence: "high",
      },
      whyNoReply: "Tenant mapping not configured for Evolution instance.",
      recommendedFix: [
        "Insert workspace_whatsapp_connections (provider evolution, provider_instance_id = EVOLUTION_INSTANCE_NAME).",
      ],
    };
  }

  return {
    breakingPoint: {
      step: "none_observed",
      summary:
        "No definitive break detected from persisted signals — run a live test message and re-audit.",
      confidence: "low",
    },
    whyNoReply:
      "Insufficient recent webhook/DB activity to pinpoint failure. Send a test DM to the business number, then call this endpoint again within 15 minutes.",
    recommendedFix: [
      "Send test message personal → business (+39 379 378 7910).",
      "Re-run GET /api/debug/whatsapp-pipeline-audit immediately after.",
      "Also run /api/debug/whatsapp-inbound for Evolution webhook URL parity.",
    ],
  };
}

export function buildPipelineChecklist(input: {
  evolutionConfigured: boolean;
  connectionState: string | null;
  webhookUrlMatches: boolean | null;
  inboundHeartbeat: WhatsAppWebhookHeartbeat | null;
  lastProcessedAt: string | null;
  lastClientConversationAt: string | null;
  lastAiConversationAt: string | null;
  primaryOutbound: "meta" | "evolution" | null;
  outboundHeartbeat: WhatsAppWebhookHeartbeat | null;
  runtimeOutboundSent: boolean;
  inboundStatus: string | null;
}): { checklist: PipelineChecklist; evidence: Record<string, string> } {
  const recentWebhook = isRecent(input.inboundHeartbeat?.last_webhook_received_at);
  const stateOpen =
    !input.connectionState || input.connectionState.toLowerCase() === "open";

  const evolutionInbound: PipelineCheckAnswer = !input.evolutionConfigured
    ? "unknown"
    : stateOpen
      ? recentWebhook
        ? true
        : "partial"
      : false;

  const evolutionForwarding: PipelineCheckAnswer = !input.evolutionConfigured
    ? "unknown"
    : input.webhookUrlMatches === false
      ? false
      : recentWebhook
        ? true
        : false;

  const agentive01Receiving: PipelineCheckAnswer = recentWebhook
    ? input.inboundStatus === "unauthorized"
      ? false
      : true
    : false;

  const stored: PipelineCheckAnswer =
    Boolean(input.lastProcessedAt) || Boolean(input.lastClientConversationAt)
      ? true
      : recentWebhook && input.inboundStatus === "processed"
        ? true
        : recentWebhook
          ? "partial"
          : false;

  const aiTriggered: PipelineCheckAnswer =
    input.inboundStatus === "processed" ||
    input.inboundStatus === "processed_sent" ||
    Boolean(input.lastClientConversationAt)
      ? true
      : input.inboundStatus === "error"
        ? false
        : "unknown";

  const openAiReply: PipelineCheckAnswer = input.lastAiConversationAt
    ? input.lastClientConversationAt &&
      Date.parse(input.lastAiConversationAt) >=
        Date.parse(input.lastClientConversationAt)
      ? true
      : "partial"
    : aiTriggered === true
      ? false
      : "unknown";

  const outboundAttempted: PipelineCheckAnswer =
    input.inboundStatus === "processed_sent" ||
    input.runtimeOutboundSent ||
    Boolean(input.outboundHeartbeat?.last_phone)
      ? true
      : input.inboundStatus === "processed"
        ? false
        : "unknown";

  const userReceives: PipelineCheckAnswer =
    outboundAttempted === true &&
    (input.outboundHeartbeat?.last_delivery_status === "DELIVERED" ||
      input.outboundHeartbeat?.last_delivery_status === "READ" ||
      input.inboundStatus === "processed_sent")
      ? "partial"
      : outboundAttempted === false
        ? false
        : "unknown";

  return {
    checklist: {
      evolutionInboundReachingInstance: evolutionInbound,
      evolutionForwardingWebhookToAgentive01: evolutionForwarding,
      agentive01ReceivingWebhook: agentive01Receiving,
      inboundStoredInSupabase: stored,
      aiPipelineTriggered: aiTriggered,
      openAiReplyGenerated: openAiReply,
      outboundSendAttempted: outboundAttempted,
      outboundProvider:
        input.primaryOutbound ??
        inferOutboundProviderFromHeartbeat(input.outboundHeartbeat),
      userReceivesReply: userReceives,
    },
    evidence: {
      evolutionInboundReachingInstance: `connectionState=${input.connectionState ?? "n/a"}, recentWebhook=${recentWebhook}`,
      evolutionForwardingWebhookToAgentive01: `webhookUrlMatches=${input.webhookUrlMatches}, lastWebhookAt=${input.inboundHeartbeat?.last_webhook_received_at ?? "never"}`,
      agentive01ReceivingWebhook: `last_processing_status=${input.inboundStatus ?? "n/a"}`,
      inboundStoredInSupabase: `lastProcessedAt=${input.lastProcessedAt ?? "n/a"}, lastClientConversationAt=${input.lastClientConversationAt ?? "n/a"}`,
      aiPipelineTriggered: `inboundStatus=${input.inboundStatus ?? "n/a"}`,
      openAiReplyGenerated: `lastAiAt=${input.lastAiConversationAt ?? "n/a"}`,
      outboundSendAttempted: `inboundStatus=${input.inboundStatus ?? "n/a"}, runtimeSent=${input.runtimeOutboundSent}`,
      outboundProvider: `primary=${input.primaryOutbound ?? "n/a"}, heartbeatStatus=${input.outboundHeartbeat?.last_processing_status ?? "n/a"}`,
      userReceivesReply: `deliveryStatus=${input.outboundHeartbeat?.last_delivery_status ?? "n/a"}`,
    },
  };
}
