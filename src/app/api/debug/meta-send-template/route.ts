import { NextResponse } from "next/server";
import { getOutboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";
import {
  sendMetaWhatsAppTemplateSafe,
  isMetaWhatsAppConfigured,
} from "@/lib/meta/client";
import {
  APPROVED_META_TEMPLATES,
  isApprovedMetaTemplateName,
  listApprovedMetaTemplateNames,
  parseMetaGraphMessagesResponse,
} from "@/lib/meta/templates";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";
import { redactEndpointUrl } from "@/lib/security/redact-debug-response";
import { getAppUrl } from "@/lib/stripe/app-url";

const ROUTE = "/api/debug/meta-send-template";
const WEBHOOK_POLL_MS = 8_000;
const WEBHOOK_POLL_INTERVAL_MS = 500;

type HeartbeatSummary = {
  lastWebhookReceivedAt: string | null;
  lastMessageId: string | null;
  lastPhone: string | null;
  lastProcessingStatus: string | null;
  lastDeliveryStatus: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

function summarizeHeartbeat(
  heartbeat: Awaited<ReturnType<typeof getOutboundHeartbeat>>
): HeartbeatSummary | null {
  if (!heartbeat) {
    return null;
  }

  return {
    lastWebhookReceivedAt: heartbeat.last_webhook_received_at,
    lastMessageId: heartbeat.last_evolution_message_id ?? heartbeat.last_message_id,
    lastPhone: heartbeat.last_phone,
    lastProcessingStatus: heartbeat.last_processing_status,
    lastDeliveryStatus: heartbeat.last_delivery_status,
    lastError: heartbeat.last_error,
    updatedAt: heartbeat.updated_at,
  };
}

async function waitForWebhookStatusUpdate(
  providerMessageId: string | undefined,
  startedAt: number
): Promise<{
  heartbeat: Awaited<ReturnType<typeof getOutboundHeartbeat>>;
  polledMs: number;
  matchedMessage: boolean;
}> {
  if (!providerMessageId) {
    return {
      heartbeat: await getOutboundHeartbeat(),
      polledMs: 0,
      matchedMessage: false,
    };
  }

  while (Date.now() - startedAt < WEBHOOK_POLL_MS) {
    const heartbeat = await getOutboundHeartbeat();
    const messageId = heartbeat?.last_evolution_message_id ?? heartbeat?.last_message_id;
    const hasDeliveryUpdate =
      messageId === providerMessageId &&
      Boolean(
        heartbeat?.last_delivery_status ||
          heartbeat?.last_processing_status === "meta_delivery_update" ||
          heartbeat?.last_error
      );

    if (hasDeliveryUpdate) {
      return {
        heartbeat,
        polledMs: Date.now() - startedAt,
        matchedMessage: true,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, WEBHOOK_POLL_INTERVAL_MS));
  }

  const heartbeat = await getOutboundHeartbeat();
  const messageId = heartbeat?.last_evolution_message_id ?? heartbeat?.last_message_id;

  return {
    heartbeat,
    polledMs: Date.now() - startedAt,
    matchedMessage: messageId === providerMessageId,
  };
}

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const templateName = url.searchParams.get("template")?.trim() ?? "hello_world";
  const languageCode = url.searchParams.get("language")?.trim() || undefined;
  const bodyParamRaw = url.searchParams.get("body")?.trim();
  const bodyParameters = bodyParamRaw
    ? bodyParamRaw.split(",").map((value) => value.trim())
    : undefined;
  const testNumber = process.env.WHATSAPP_HEALTH_TEST_NUMBER?.trim() ?? null;

  if (!isMetaWhatsAppConfigured()) {
    return NextResponse.json(
      {
        error:
          "Meta WhatsApp Cloud API is not configured. Set META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID.",
      },
      { status: 503 }
    );
  }

  if (!isApprovedMetaTemplateName(templateName)) {
    return NextResponse.json(
      {
        error: `Unknown or unapproved template "${templateName}".`,
        approvedTemplates: listApprovedMetaTemplateNames(),
      },
      { status: 400 }
    );
  }

  if (!testNumber) {
    return NextResponse.json(
      {
        error:
          "Set WHATSAPP_HEALTH_TEST_NUMBER (E.164 digits) to run a live template send from this endpoint.",
        approvedTemplates: listApprovedMetaTemplateNames(),
      },
      { status: 400 }
    );
  }

  const webhookBefore = await getOutboundHeartbeat();
  const sendStartedAt = Date.now();

  const sendResult = await sendMetaWhatsAppTemplateSafe(testNumber, {
    name: templateName,
    languageCode,
    bodyParameters,
  });

  const graphResponse = parseMetaGraphMessagesResponse(sendResult.responseBody);
  const webhookPoll = await waitForWebhookStatusUpdate(
    sendResult.providerMessageId,
    sendStartedAt
  );

  const templateDefinition = APPROVED_META_TEMPLATES[templateName];
  const appUrl = getAppUrl();

  return NextResponse.json({
    debugLabel: "meta-send-template-v1",
    timestamp: new Date().toISOString(),
    template: {
      name: templateName,
      languageCode: languageCode ?? templateDefinition.languageCode,
      sendType: "template",
      bodyParametersUsed:
        bodyParameters ?? templateDefinition.defaultBodyParameters ?? null,
    },
    destinationNumber: testNumber,
    graphApi: {
      ok: Boolean(sendResult.sentToWhatsApp),
      httpStatus: sendResult.status ?? null,
      endpoint: sendResult.endpoint ? redactEndpointUrl(sendResult.endpoint) : null,
      providerMessageId: sendResult.providerMessageId ?? null,
      messageStatus: graphResponse.messages?.[0]?.message_status ?? null,
      response: graphResponse,
      error: sendResult.error ?? graphResponse.error?.message ?? null,
    },
    webhook: {
      beforeSend: summarizeHeartbeat(webhookBefore),
      afterSend: summarizeHeartbeat(webhookPoll.heartbeat),
      polledMs: webhookPoll.polledMs,
      matchedProviderMessageId: webhookPoll.matchedMessage,
      deliveryStatus: webhookPoll.heartbeat?.last_delivery_status ?? null,
      processingStatus: webhookPoll.heartbeat?.last_processing_status ?? null,
      lastError: webhookPoll.heartbeat?.last_error ?? null,
    },
    endpoints: {
      metaWebhook: `${appUrl}/api/webhooks/meta`,
      metaMessageStatus: `${appUrl}/api/debug/meta-message-status?messageId=${encodeURIComponent(sendResult.providerMessageId ?? "")}`,
      thisEndpoint: `${appUrl}${ROUTE}?template=${encodeURIComponent(templateName)}`,
    },
    notes: [
      "Protected: CRON_SECRET (Bearer or x-cron-secret) or workspace owner/admin.",
      "Uses Graph API type=template for business-initiated delivery outside the 24h window.",
      "graphApi.ok means Meta accepted the send (wamid); webhook.deliveryStatus confirms handset delivery.",
      "Optional ?body=param1,param2 for templates with body variables.",
      "Optional ?language=en_US to override the registry language code.",
    ],
  });
}
