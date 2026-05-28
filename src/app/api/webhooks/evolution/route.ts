import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  console.log("[WhatsApp debug] Webhook received");

  let claimedMessageId: string | null = null;
  let claimedInstance: string | null = null;
  let adminClient: ReturnType<typeof createAdminClient> | null = null;

  try {
    const payload = (await request.json()) as EvolutionWebhookPayload;

    logIncomingWebhookPayload(payload);

    if (!verifyEvolutionWebhook(request, payload)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incoming = parseEvolutionWebhook(payload);
    if (!incoming) {
      return NextResponse.json({ ok: true, skipped: true });
    }

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

    console.error("[Evolution webhook] Processing failed", error);
    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
