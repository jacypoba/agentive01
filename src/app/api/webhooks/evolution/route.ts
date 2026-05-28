import { NextResponse } from "next/server";
import {
  recordWebhookHeartbeat,
  recordWebhookHit,
} from "@/lib/evolution/inbound-heartbeat";
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

    void recordWebhookHeartbeat({
      last_webhook_received_at: new Date().toISOString(),
      last_event: payload.event ?? null,
    });

    logIncomingWebhookPayload(payload);

    if (!verifyEvolutionWebhook(request, payload)) {
      void recordWebhookHeartbeat({
        last_error: "Unauthorized webhook request.",
        last_http_status: 401,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incoming = parseEvolutionWebhook(payload);
    if (!incoming) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    void recordWebhookHeartbeat({
      last_message_id: incoming.messageId,
      last_phone: incoming.phoneDigits,
      last_event: payload.event ?? "messages.upsert",
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

    void recordWebhookHeartbeat({
      last_http_status: 200,
      last_error: null,
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

    void recordWebhookHeartbeat({
      last_error: message,
      last_http_status: 500,
    });

    console.error("[Evolution webhook] Processing failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
