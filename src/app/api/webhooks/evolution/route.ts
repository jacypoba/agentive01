import { NextResponse } from "next/server";
import { handleEvolutionMessageStatusUpdate } from "@/lib/evolution/message-status-update";
import {
  logIncomingWebhookPayload,
  parseEvolutionWebhook,
  verifyEvolutionWebhookAsync,
} from "@/lib/evolution/parse-webhook";
import { recordInboundHeartbeat, recordWebhookHit } from "@/lib/evolution/whatsapp-heartbeat";
import { handleInboundWhatsAppMessage } from "@/lib/whatsapp/handle-inbound";
import type { EvolutionWebhookPayload } from "@/lib/evolution/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Evolution webhook endpoint is alive (fallback provider). Use POST from Evolution.",
    endpoint: "/api/webhooks/evolution",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  console.log("[EVOLUTION WEBHOOK HIT]", {
    at: new Date().toISOString(),
    method: request.method,
    url: request.url,
  });

  void recordWebhookHit();

  try {
    const payload = (await request.json()) as EvolutionWebhookPayload;

    void recordInboundHeartbeat({
      last_webhook_received_at: new Date().toISOString(),
      instance: payload.instance ?? null,
      last_processing_status: "received",
    });

    if (payload.event === "messages.update") {
      void handleEvolutionMessageStatusUpdate(payload);
      return NextResponse.json({ ok: true, handled: "messages.update" });
    }

    logIncomingWebhookPayload(payload);

    if (!(await verifyEvolutionWebhookAsync(request, payload))) {
      void recordInboundHeartbeat({
        last_processing_status: "unauthorized",
        last_error: "Unauthorized webhook request.",
      });
      console.warn("[EVOLUTION WEBHOOK UNAUTHORIZED]", {
        hasPayloadApiKey: Boolean(payload.apikey),
        hasHeaderApiKey: Boolean(request.headers.get("apikey")),
        hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
        hasQuerySecret: Boolean(new URL(request.url).searchParams.get("secret")),
        instance: payload.instance ?? null,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incoming = parseEvolutionWebhook(payload);
    if (!incoming) {
      void recordInboundHeartbeat({
        last_processing_status: "skipped",
        last_error: null,
      });
      return NextResponse.json({ ok: true, skipped: true });
    }

    const result = await handleInboundWhatsAppMessage(incoming);

    if (!result.ok) {
      console.error("[Evolution webhook] Processing failed", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if ("skipped" in result && result.skipped) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: result.reason,
        messageId: result.messageId,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";
    void recordInboundHeartbeat({
      last_processing_status: "error",
      last_error: message,
    });
    console.error("[Evolution webhook] Processing failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
