import { createHmac, timingSafeEqual } from "crypto";
import { normalizePhoneDigits } from "@/lib/phone/normalize";
import {
  getMetaInstanceId,
  isMetaWhatsAppConfigured,
} from "@/lib/whatsapp/config";
import type { WhatsAppSendResult } from "@/lib/whatsapp/types";
import type { MetaWebhookPayload } from "@/lib/meta/types";
import type { ParsedIncomingMessage } from "@/lib/whatsapp/types";
import { recordOutboundFailure, recordOutboundSuccess } from "@/lib/evolution/outbound-health";
import { recordOutboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";

function getMetaConfig() {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "Meta WhatsApp Cloud API is not configured. Set META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID."
    );
  }

  return { accessToken, phoneNumberId, graphVersion };
}

export { isMetaWhatsAppConfigured };

function mapMetaDeliveryStatus(status: string | undefined): string | null {
  if (!status) return null;
  const normalized = status.toUpperCase();
  if (normalized === "SENT") return "SERVER_ACK";
  if (normalized === "DELIVERED") return "DELIVERED";
  if (normalized === "READ") return "READ";
  if (normalized === "FAILED") return "ERROR";
  return normalized;
}

function buildSendResult(input: {
  ok: boolean;
  status: number;
  endpoint: string;
  responseBody: string;
  destinationNumber: string;
  payload: Record<string, unknown>;
}): WhatsAppSendResult {
  let providerMessageId: string | undefined;
  let deliveryStatus: string | undefined;

  try {
    const json = JSON.parse(input.responseBody) as {
      messages?: Array<{ id?: string; message_status?: string }>;
      error?: { message?: string; code?: number };
    };

    providerMessageId = json.messages?.[0]?.id;
    deliveryStatus = mapMetaDeliveryStatus(json.messages?.[0]?.message_status) ?? undefined;

    if (!input.ok) {
      return {
        success: false,
        status: input.status,
        endpoint: input.endpoint,
        responseBody: input.responseBody,
        destinationNumber: input.destinationNumber,
        provider: "meta",
        providerMessageId,
        deliveryStatus,
        error: json.error?.message ?? `Meta API request failed (${input.status})`,
      };
    }
  } catch {
    if (!input.ok) {
      return {
        success: false,
        status: input.status,
        endpoint: input.endpoint,
        responseBody: input.responseBody,
        destinationNumber: input.destinationNumber,
        provider: "meta",
        error: `Meta API request failed (${input.status})`,
      };
    }
  }

  const sentToWhatsApp = input.ok;
  return {
    success: input.ok,
    status: input.status,
    endpoint: input.endpoint,
    responseBody: input.responseBody,
    destinationNumber: input.destinationNumber,
    provider: "meta",
    providerMessageId,
    deliveryKey: `${input.destinationNumber}@s.whatsapp.net`,
    deliveryStatus: deliveryStatus ?? (sentToWhatsApp ? "SENT" : undefined),
    accepted: input.ok,
    pendingOnly: false,
    deliveryConfirmed: sentToWhatsApp,
    sentToWhatsApp,
  };
}

async function postMetaMessages(payload: Record<string, unknown>, destinationNumber: string) {
  const config = getMetaConfig();
  const endpoint = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;

  console.log("[META WHATSAPP SEND REQUEST]", {
    endpoint,
    destinationNumber,
    payload,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();
  const result = buildSendResult({
    ok: response.ok,
    status: response.status,
    endpoint,
    responseBody,
    destinationNumber,
    payload,
  });

  console.log("[META WHATSAPP SEND RESPONSE]", {
    endpoint,
    status: response.status,
    destinationNumber,
    providerMessageId: result.providerMessageId ?? null,
    deliveryStatus: result.deliveryStatus ?? null,
    sentToWhatsApp: result.sentToWhatsApp ?? null,
    responseBody,
  });

  void recordOutboundHeartbeat({
    instance: getMetaInstanceId(),
    last_phone: destinationNumber,
    last_message_id: result.providerMessageId ?? null,
    last_evolution_message_id: result.providerMessageId ?? null,
    last_delivery_key: result.deliveryKey ?? null,
    last_delivery_status: result.deliveryStatus ?? null,
    last_response_body: responseBody,
    last_processing_status: result.sentToWhatsApp ? "meta_sent" : "meta_failed",
    last_error: result.error ?? null,
  });

  return result;
}

export async function sendMetaWhatsAppTextSafe(
  phoneDigits: string,
  text: string
): Promise<WhatsAppSendResult> {
  const trimmed = text.trim();
  const destinationNumber = normalizePhoneDigits(phoneDigits);

  if (!trimmed) {
    return { success: false, provider: "meta", error: "Cannot send empty WhatsApp text message." };
  }

  if (!destinationNumber) {
    return { success: false, provider: "meta", error: "Invalid destination phone number." };
  }

  try {
    const result = await postMetaMessages(
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: destinationNumber,
        type: "text",
        text: { body: trimmed },
      },
      destinationNumber
    );

    if (result.sentToWhatsApp) {
      recordOutboundSuccess({
        kind: "text",
        phoneDigits: destinationNumber,
        destinationNumber,
        endpoint: result.endpoint,
        status: result.status,
        responseBody: result.responseBody,
        evolutionMessageId: result.providerMessageId,
        deliveryKey: result.deliveryKey,
        deliveryStatus: result.deliveryStatus,
      });
    } else {
      recordOutboundFailure({
        kind: "text",
        phoneDigits: destinationNumber,
        destinationNumber,
        endpoint: result.endpoint,
        status: result.status,
        responseBody: result.responseBody,
        reason: result.error ?? "Meta text send failed.",
      });
    }

    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Meta network error.";
    recordOutboundFailure({ kind: "text", phoneDigits: destinationNumber, reason });
    return { success: false, provider: "meta", destinationNumber, error: reason };
  }
}

export async function sendMetaWhatsAppMediaSafe(
  phoneDigits: string,
  input: {
    mediatype: "image" | "video" | "document";
    media: string;
    caption?: string;
    fileName?: string;
  }
): Promise<WhatsAppSendResult> {
  const destinationNumber = normalizePhoneDigits(phoneDigits);
  const mediaUrl = input.media.trim();

  if (!destinationNumber || !mediaUrl) {
    return {
      success: false,
      provider: "meta",
      error: "Invalid destination or media URL.",
    };
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: destinationNumber,
    type: input.mediatype,
    [input.mediatype]: {
      link: mediaUrl,
      ...(input.caption?.trim() ? { caption: input.caption.trim() } : {}),
      ...(input.mediatype === "document" && input.fileName
        ? { filename: input.fileName }
        : {}),
    },
  };

  try {
    const result = await postMetaMessages(payload, destinationNumber);

    if (result.sentToWhatsApp) {
      recordOutboundSuccess({
        kind: "image",
        phoneDigits: destinationNumber,
        destinationNumber,
        endpoint: result.endpoint,
        status: result.status,
        responseBody: result.responseBody,
        evolutionMessageId: result.providerMessageId,
        deliveryKey: result.deliveryKey,
        deliveryStatus: result.deliveryStatus,
        mediaUrl,
      });
    } else {
      recordOutboundFailure({
        kind: "image",
        phoneDigits: destinationNumber,
        destinationNumber,
        endpoint: result.endpoint,
        status: result.status,
        responseBody: result.responseBody,
        reason: result.error ?? "Meta media send failed.",
        mediaUrl,
      });
    }

    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Meta media network error.";
    recordOutboundFailure({
      kind: "image",
      phoneDigits: destinationNumber,
      reason,
      mediaUrl,
    });
    return { success: false, provider: "meta", destinationNumber, error: reason };
  }
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET?.trim();
  if (!appSecret) {
    return process.env.NODE_ENV !== "production";
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export function parseMetaWebhook(payload: MetaWebhookPayload): ParsedIncomingMessage | null {
  if (payload.object !== "whatsapp_business_account") {
    return null;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") {
        continue;
      }

      const value = change.value;
      if (!value) {
        continue;
      }

      const inbound = value.messages?.[0];
      if (!inbound?.from || !inbound.id) {
        continue;
      }

      let text: string | null = null;
      if (inbound.type === "text" && inbound.text?.body?.trim()) {
        text = inbound.text.body.trim();
      } else if (inbound.type === "button" && inbound.button?.text?.trim()) {
        text = inbound.button.text.trim();
      } else if (inbound.type === "interactive") {
        text =
          inbound.interactive?.button_reply?.title?.trim() ??
          inbound.interactive?.list_reply?.title?.trim() ??
          null;
      } else if (inbound.image?.caption?.trim()) {
        text = inbound.image.caption.trim();
      } else if (inbound.video?.caption?.trim()) {
        text = inbound.video.caption.trim();
      }

      if (!text) {
        continue;
      }

      const phoneDigits = normalizePhoneDigits(inbound.from);
      const phoneNumberId =
        value.metadata?.phone_number_id?.trim() ?? getMetaInstanceId();
      const pushName =
        value.contacts?.[0]?.profile?.name?.trim() || "WhatsApp Lead";

      return {
        provider: "meta",
        instance: phoneNumberId,
        remoteJid: `${phoneDigits}@s.whatsapp.net`,
        phoneDigits,
        pushName,
        text,
        messageId: inbound.id,
      };
    }
  }

  return null;
}

export function parseMetaStatusUpdates(payload: MetaWebhookPayload) {
  const updates: Array<{
    messageId: string;
    recipientId: string;
    status: string;
    rawStatus: string;
  }> = [];

  if (payload.object !== "whatsapp_business_account") {
    return updates;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (!status.id || !status.status) continue;
        updates.push({
          messageId: status.id,
          recipientId: status.recipient_id ?? "",
          status: mapMetaDeliveryStatus(status.status) ?? status.status.toUpperCase(),
          rawStatus: status.status,
        });
      }
    }
  }

  return updates;
}
