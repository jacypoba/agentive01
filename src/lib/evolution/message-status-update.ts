import type { EvolutionWebhookPayload } from "@/lib/evolution/types";
import {
  mapEvolutionDeliveryStatus,
  parseEvolutionSendResponse,
} from "@/lib/evolution/parse-evolution-response";
import { recordOutboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";
import { updateLastOutboundDeliveryStatus } from "@/lib/evolution/outbound-health";

function readKeyRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Handle Evolution messages.update delivery ACK events (non-blocking). */
export async function handleEvolutionMessageStatusUpdate(
  payload: EvolutionWebhookPayload
): Promise<boolean> {
  if (payload.event !== "messages.update") {
    return false;
  }

  const data = readKeyRecord(payload.data);
  if (!data) {
    return true;
  }

  const key = readKeyRecord(data.key);
  const update = readKeyRecord(data.update);
  const parsed = parseEvolutionSendResponse(JSON.stringify(data));
  const messageId =
    (typeof key?.id === "string" ? key.id : null) ?? parsed.messageId;
  const deliveryKey =
    (typeof key?.remoteJid === "string" ? key.remoteJid : null) ??
    parsed.deliveryKey;
  const rawStatus = update?.status ?? data.status ?? parsed.rawStatus;
  const deliveryStatus = mapEvolutionDeliveryStatus(rawStatus);

  if (!deliveryStatus) {
    return true;
  }

  console.log("[WHATSAPP DELIVERY UPDATE]", {
    messageId,
    deliveryKey,
    deliveryStatus,
    rawStatus,
    instance: payload.instance ?? null,
  });

  updateLastOutboundDeliveryStatus({
    evolutionMessageId: messageId,
    deliveryKey,
    deliveryStatus,
  });

  void recordOutboundHeartbeat({
    instance: payload.instance ?? null,
    last_message_id: messageId,
    last_evolution_message_id: messageId,
    last_delivery_key: deliveryKey,
    last_delivery_status: deliveryStatus,
    last_processing_status: "delivery_update",
    last_error: null,
  });

  return true;
}
