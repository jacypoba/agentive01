import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppWebhookHeartbeat } from "@/types/database";

export const HEARTBEAT_INBOUND_ID = "inbound";
export const HEARTBEAT_OUTBOUND_ID = "outbound";

export type WhatsAppHeartbeatUpdate = {
  instance?: string | null;
  last_webhook_received_at?: string;
  last_message_id?: string | null;
  last_remote_jid?: string | null;
  last_phone?: string | null;
  last_processing_status?: string | null;
  last_error?: string | null;
  last_response_body?: string | null;
  last_evolution_message_id?: string | null;
  last_delivery_key?: string | null;
  last_delivery_status?: string | null;
};

async function readHeartbeatRow(
  id: string
): Promise<WhatsAppWebhookHeartbeat | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("whatsapp_webhook_heartbeat")
      .select("*")
      .eq("id", id)
      .limit(1);

    if (error) {
      console.error("[WhatsApp heartbeat] read failed", { id, message: error.message });
      return null;
    }

    return data?.[0] ?? null;
  } catch (error) {
    console.error("[WhatsApp heartbeat] read error", { id, error });
    return null;
  }
}

/** Best-effort persistence — must never throw to callers. */
async function upsertHeartbeatRow(
  id: string,
  direction: "inbound" | "outbound",
  update: WhatsAppHeartbeatUpdate
): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await admin.from("whatsapp_webhook_heartbeat").upsert(
      {
        id,
        last_direction: direction,
        updated_at: now,
        ...update,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("[WhatsApp heartbeat] upsert failed", {
        id,
        direction,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("[WhatsApp heartbeat] upsert error", { id, direction, error });
  }
}

export async function getInboundHeartbeat(): Promise<WhatsAppWebhookHeartbeat | null> {
  return readHeartbeatRow(HEARTBEAT_INBOUND_ID);
}

export async function getOutboundHeartbeat(): Promise<WhatsAppWebhookHeartbeat | null> {
  return readHeartbeatRow(HEARTBEAT_OUTBOUND_ID);
}

/** @deprecated Prefer getInboundHeartbeat(). */
export async function getWebhookHeartbeat(): Promise<WhatsAppWebhookHeartbeat | null> {
  return getInboundHeartbeat();
}

export async function recordInboundHeartbeat(
  update: WhatsAppHeartbeatUpdate
): Promise<void> {
  await upsertHeartbeatRow(HEARTBEAT_INBOUND_ID, "inbound", update);
}

export async function recordOutboundHeartbeat(
  update: WhatsAppHeartbeatUpdate
): Promise<void> {
  await upsertHeartbeatRow(HEARTBEAT_OUTBOUND_ID, "outbound", {
    last_webhook_received_at: new Date().toISOString(),
    ...update,
  });
}

export async function recordWebhookHit(): Promise<void> {
  await recordInboundHeartbeat({
    last_webhook_received_at: new Date().toISOString(),
    last_processing_status: "webhook_hit",
    last_error: null,
  });
}

/** @deprecated Prefer recordInboundHeartbeat(). */
export async function recordWebhookHeartbeat(
  update: WhatsAppHeartbeatUpdate
): Promise<void> {
  await recordInboundHeartbeat(update);
}
