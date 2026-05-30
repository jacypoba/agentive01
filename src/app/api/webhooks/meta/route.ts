import { NextResponse } from "next/server";
import {
  parseMetaWebhook,
  verifyMetaWebhookSignature,
} from "@/lib/meta/client";
import { handleMetaMessageStatusUpdate } from "@/lib/meta/message-status-update";
import type { MetaWebhookPayload } from "@/lib/meta/types";
import { recordInboundHeartbeat, recordWebhookHit } from "@/lib/evolution/whatsapp-heartbeat";
import { handleInboundWhatsAppMessage } from "@/lib/whatsapp/handle-inbound";
import { getAppUrl } from "@/lib/stripe/app-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    console.log("[META WEBHOOK VERIFY] Challenge accepted");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    message: "Meta WhatsApp webhook endpoint. Use GET with hub.verify_token for setup.",
    endpoint: "/api/webhooks/meta",
    expectedWebhookUrl: `${getAppUrl()}/api/webhooks/meta`,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  console.log("[META WEBHOOK HIT]", {
    at: new Date().toISOString(),
    url: request.url,
  });

  void recordWebhookHit();

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    void recordInboundHeartbeat({
      last_processing_status: "unauthorized",
      last_error: "Invalid Meta webhook signature.",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  void recordInboundHeartbeat({
    last_webhook_received_at: new Date().toISOString(),
    last_processing_status: "received",
  });

  void handleMetaMessageStatusUpdate(payload);

  const incoming = parseMetaWebhook(payload);
  if (!incoming) {
    void recordInboundHeartbeat({
      last_processing_status: "skipped",
    });
    return NextResponse.json({ ok: true, skipped: true });
  }

  console.log("[META WEBHOOK INBOUND]", {
    messageId: incoming.messageId,
    phoneDigits: incoming.phoneDigits,
    pushName: incoming.pushName,
    preview: incoming.text.slice(0, 120),
  });

  const result = await handleInboundWhatsAppMessage(incoming);

  if (!result.ok) {
    console.error("[META WEBHOOK] Processing failed", result.error);
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
}
