import {
  releaseWhatsAppMessageClaim,
  tryClaimWhatsAppMessage,
} from "@/lib/evolution/message-dedup";
import { isSubscriptionBillingBlockError } from "@/lib/billing/workspace-subscription";
import { processIncomingWhatsAppMessage } from "@/lib/evolution/process-incoming";
import { recordInboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ParsedIncomingMessage } from "@/lib/whatsapp/types";

export type HandleInboundWhatsAppResult =
  | { ok: true; skipped: true; reason: string; messageId?: string }
  | {
      ok: true;
      messageId: string;
      leadId: string;
      isNewLead: boolean;
      whatsappSent: boolean;
      clientMessageId: string;
      aiMessageId: string | null;
    }
  | { ok: false; error: string };

export async function handleInboundWhatsAppMessage(
  incoming: ParsedIncomingMessage
): Promise<HandleInboundWhatsAppResult> {
  let claimedMessageId: string | null = null;
  let claimedInstance: string | null = null;
  let adminClient: ReturnType<typeof createAdminClient> | null = null;

  try {
    void recordInboundHeartbeat({
      last_webhook_received_at: new Date().toISOString(),
      instance: incoming.instance,
      last_message_id: incoming.messageId,
      last_remote_jid: incoming.remoteJid,
      last_phone: incoming.phoneDigits,
      last_processing_status: "processing",
      last_error: null,
    });

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
      });
      return {
        ok: true,
        skipped: true,
        reason: "duplicate_message_id",
        messageId: incoming.messageId,
      };
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

    return {
      ok: true,
      messageId: incoming.messageId,
      leadId: result.lead.id,
      isNewLead: result.isNewLead,
      whatsappSent: result.whatsappSent,
      clientMessageId: result.clientMessage.id,
      aiMessageId: result.aiMessage?.id ?? null,
    };
  } catch (error) {
    if (isSubscriptionBillingBlockError(error)) {
      const message =
        error instanceof Error ? error.message : "Subscription inactive.";

      console.log("[WhatsApp inbound] Skipped — subscription inactive", {
        messageId: incoming.messageId,
        instance: incoming.instance,
        phone: incoming.phoneDigits,
      });

      void recordInboundHeartbeat({
        last_processing_status: "skipped",
        last_error: message,
      });

      return {
        ok: true,
        skipped: true,
        reason: "subscription_inactive",
        messageId: incoming.messageId,
      };
    }

    if (claimedMessageId && claimedInstance && adminClient) {
      try {
        await releaseWhatsAppMessageClaim(
          adminClient,
          claimedMessageId,
          claimedInstance
        );
      } catch (releaseError) {
        console.error("[WhatsApp inbound] Failed to release claim", releaseError);
      }
    }

    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";

    void recordInboundHeartbeat({
      last_processing_status: "error",
      last_error: message,
    });

    return { ok: false, error: message };
  }
}
