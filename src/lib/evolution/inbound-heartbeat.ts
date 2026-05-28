import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppWebhookHeartbeat } from "@/types/database";

const HEARTBEAT_ID = "global";

export type WebhookHeartbeatUpdate = {
  last_webhook_received_at?: string;
  last_message_id?: string | null;
  last_phone?: string | null;
  last_event?: string | null;
  last_error?: string | null;
  last_http_status?: number | null;
};

export async function getWebhookHeartbeat(): Promise<WhatsAppWebhookHeartbeat | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("whatsapp_webhook_heartbeat")
      .select("*")
      .eq("id", HEARTBEAT_ID)
      .limit(1);

    if (error) {
      console.error("[Evolution webhook heartbeat] read failed", error.message);
      return null;
    }

    return data?.[0] ?? null;
  } catch (error) {
    console.error("[Evolution webhook heartbeat] read error", error);
    return null;
  }
}

/** Best-effort persistence — must never throw to callers. */
export async function recordWebhookHeartbeat(
  update: WebhookHeartbeatUpdate
): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await admin.from("whatsapp_webhook_heartbeat").upsert(
      {
        id: HEARTBEAT_ID,
        updated_at: now,
        ...update,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("[Evolution webhook heartbeat] upsert failed", error.message);
    }
  } catch (error) {
    console.error("[Evolution webhook heartbeat] upsert error", error);
  }
}

export async function recordWebhookHit(): Promise<void> {
  await recordWebhookHeartbeat({
    last_webhook_received_at: new Date().toISOString(),
    last_error: null,
  });
}
