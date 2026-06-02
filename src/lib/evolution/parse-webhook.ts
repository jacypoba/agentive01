import { isFromMe } from "@/lib/evolution/from-me";
import {
  isIndividualChat,
  phoneFromRemoteJid,
} from "@/lib/phone/normalize";
import type {
  EvolutionMessageData,
  EvolutionWebhookPayload,
  ParsedIncomingMessage,
} from "@/lib/evolution/types";
import {
  verifyEvolutionWebhook,
  verifyEvolutionWebhookAsync,
} from "@/lib/evolution/evolution-webhook-auth";

export { verifyEvolutionWebhook, verifyEvolutionWebhookAsync };

const LOG_PREFIX = "[Evolution webhook]";

function extractMessageText(data: EvolutionMessageData): string | null {
  const message = data.message;
  if (!message) return null;

  if (message.conversation?.trim()) {
    return message.conversation.trim();
  }

  if (message.extendedTextMessage?.text?.trim()) {
    return message.extendedTextMessage.text.trim();
  }

  if (message.imageMessage?.caption?.trim()) {
    return message.imageMessage.caption.trim();
  }

  if (message.videoMessage?.caption?.trim()) {
    return message.videoMessage.caption.trim();
  }

  return null;
}

export function parseEvolutionWebhook(
  payload: EvolutionWebhookPayload
): ParsedIncomingMessage | null {
  if (payload.event !== "messages.upsert") {
    return null;
  }

  const data = payload.data;
  if (!data?.key?.remoteJid) {
    return null;
  }

  const messageId = data.key.id;
  if (!messageId) {
    console.warn(`${LOG_PREFIX} Missing message ID — skipping`, {
      remoteJid: data.key.remoteJid,
    });
    return null;
  }

  if (isFromMe(data.key.fromMe)) {
    console.log(`${LOG_PREFIX} Skipped fromMe message`, {
      messageId,
      remoteJid: data.key.remoteJid,
      fromMe: data.key.fromMe,
    });
    return null;
  }

  if (!isIndividualChat(data.key.remoteJid)) {
    return null;
  }

  const text = extractMessageText(data);
  if (!text) {
    return null;
  }

  const instance = payload.instance ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";
  if (!instance) {
    return null;
  }

  return {
    provider: "evolution",
    instance,
    remoteJid: data.key.remoteJid,
    phoneDigits: phoneFromRemoteJid(data.key.remoteJid),
    pushName: data.pushName?.trim() || "WhatsApp Lead",
    text,
    messageId,
  };
}

/** Log every messages.upsert payload key for observability. */
export function logIncomingWebhookPayload(
  payload: EvolutionWebhookPayload
): void {
  if (payload.event !== "messages.upsert") {
    console.log(`${LOG_PREFIX} Event received`, {
      event: payload.event,
      instance: payload.instance,
    });
    return;
  }

  console.log(`${LOG_PREFIX} Incoming message ID`, {
    messageId: payload.data?.key?.id ?? null,
    instance: payload.instance,
    remoteJid: payload.data?.key?.remoteJid ?? null,
    fromMe: payload.data?.key?.fromMe ?? null,
    messageType: payload.data?.messageType ?? null,
  });
}
