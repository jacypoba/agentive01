import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

const LOG_PREFIX = "[Evolution webhook]";

export async function tryClaimWhatsAppMessage(
  supabase: AdminClient,
  messageId: string,
  instance: string,
  remoteJid?: string
): Promise<boolean> {
  console.log(`${LOG_PREFIX} Claiming message ID`, {
    messageId,
    instance,
    remoteJid,
  });

  const { error } = await supabase.from("processed_whatsapp_messages").insert({
    message_id: messageId,
    instance,
    remote_jid: remoteJid ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      console.log(`${LOG_PREFIX} Duplicate message ID — skipping`, {
        messageId,
        instance,
      });
      return false;
    }
    throw new Error(`Failed to claim message ID: ${error.message}`);
  }

  console.log(`${LOG_PREFIX} Message ID claimed`, { messageId, instance });
  return true;
}

export async function releaseWhatsAppMessageClaim(
  supabase: AdminClient,
  messageId: string,
  instance: string
): Promise<void> {
  console.log(`${LOG_PREFIX} Releasing claim after failure`, {
    messageId,
    instance,
  });

  await supabase
    .from("processed_whatsapp_messages")
    .delete()
    .eq("message_id", messageId)
    .eq("instance", instance);
}
