import { updateLastOutboundDeliveryStatus } from "@/lib/evolution/outbound-health";
import { recordOutboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";
import { parseMetaStatusUpdates } from "@/lib/meta/client";
import type { MetaWebhookPayload } from "@/lib/meta/types";
import { getMetaInstanceId } from "@/lib/whatsapp/config";

/** Handle Meta Cloud API delivery status webhooks (non-blocking). */
export async function handleMetaMessageStatusUpdate(
  payload: MetaWebhookPayload
): Promise<boolean> {
  const updates = parseMetaStatusUpdates(payload);
  if (updates.length === 0) {
    return false;
  }

  for (const update of updates) {
    console.log("[META WHATSAPP DELIVERY UPDATE]", update);

    updateLastOutboundDeliveryStatus({
      evolutionMessageId: update.messageId,
      deliveryKey: update.recipientId
        ? `${update.recipientId.replace(/\D/g, "")}@s.whatsapp.net`
        : null,
      deliveryStatus: update.status,
    });

    void recordOutboundHeartbeat({
      instance: getMetaInstanceId(),
      last_message_id: update.messageId,
      last_evolution_message_id: update.messageId,
      last_phone: update.recipientId || null,
      last_delivery_status: update.status,
      last_processing_status: "meta_delivery_update",
      last_error: update.rawStatus === "failed" ? "Meta reported failed delivery." : null,
    });
  }

  return true;
}
