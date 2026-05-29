import { NextResponse } from "next/server";
import { handleEvolutionMessageStatusUpdate } from "@/lib/evolution/message-status-update";
import { recordInboundHeartbeat, recordWebhookHit } from "@/lib/evolution/whatsapp-heartbeat";
import {
  logIncomingWebhookPayload,
  parseEvolutionWebhook,
  verifyEvolutionWebhook,
} from "@/lib/evolution/parse-webhook";
import {
  releaseWhatsAppMessageClaim,
  tryClaimWhatsAppMessage,
} from "@/lib/evolution/message-dedup";
import { processIncomingWhatsAppMessage } from "@/lib/evolution/process-incoming";
import {
  describeWhatsAppPhoneRouting,
  logWhatsAppPhoneRouting,
} from "@/lib/phone/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EvolutionWebhookPayload } from "@/lib/evolution/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Evolution webhook endpoint is alive. Use POST from Evolution.",
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

  let claimedMessageId: string | null = null;
  let claimedInstance: string | null = null;
  let adminClient: ReturnType<typeof createAdminClient> | null = null;

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

    if (!verifyEvolutionWebhook(request, payload)) {
      void recordInboundHeartbeat({
        last_processing_status: "unauthorized",
        last_error: "Unauthorized webhook request.",
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

    const phoneContext = describeWhatsAppPhoneRouting({
      remoteJid: incoming.remoteJid,
      inboundPhoneDigits: incoming.phoneDigits,
      outboundPhoneInput: incoming.phoneDigits,
    });
    logWhatsAppPhoneRouting("inbound_webhook", phoneContext);

    void recordInboundHeartbeat({
      last_message_id: incoming.messageId,
      last_remote_jid: incoming.remoteJid,
      last_phone: incoming.phoneDigits,
      instance: incoming.instance,
      last_processing_status: "processing",
      last_error: null,
    });

    console.log("[WhatsApp debug] Sender phone:", incoming.phoneDigits);
    console.log("[WhatsApp debug] Incoming message text:", incoming.text);

    adminClient = createAdminClient();

    const claimed = await tryClaimWhatsAppMessage(
      adminClient,
      incoming.messageId,
      incoming.instance,
      incoming.remoteJid
    );

    if (!claimed) {
      void recordInboundHeartbeat({
        last_processing_status: "duplicate",
        last_error: null,
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "duplicate_message_id",
        messageId: incoming.messageId,
      });
    }

    claimedMessageId = incoming.messageId;
    claimedInstance = incoming.instance;

    const result = await processIncomingWhatsAppMessage(incoming);

    void recordInboundHeartbeat({
      last_processing_status: result.whatsappSent ? "processed_sent" : "processed",
      last_error:
        result.whatsappReport && result.whatsappReport.failed > 0
          ? `Outbound failures: ${result.whatsappReport.failed}/${result.whatsappReport.attempted}`
          : null,
    });

    return NextResponse.json({
      ok: true,
      messageId: incoming.messageId,
      leadId: result.lead.id,
      isNewLead: result.isNewLead,
      whatsappSent: result.whatsappSent,
      whatsappReport: result.whatsappReport,
      clientMessageId: result.clientMessage.id,
      aiMessageId: result.aiMessage?.id ?? null,
    });
  } catch (error) {
    if (claimedMessageId && claimedInstance && adminClient) {
      try {
        await releaseWhatsAppMessageClaim(
          adminClient,
          claimedMessageId,
          claimedInstance
        );
      } catch (releaseError) {
        console.error("[Evolution webhook] Failed to release claim", releaseError);
      }
    }

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
