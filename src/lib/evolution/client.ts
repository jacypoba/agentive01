import { normalizePhoneDigits } from "@/lib/phone/normalize";
import {
  recordOutboundFailure,
  recordOutboundSuccess,
} from "@/lib/evolution/outbound-health";

export type SendTextResult = {
  success: boolean;
  status?: number;
};

export type EvolutionSendResult = SendTextResult & {
  endpoint?: string;
  responseBody?: string;
  error?: string;
};

export type SendMediaPayload = {
  mediatype: "image" | "video" | "document";
  media: string;
  caption?: string;
  mimetype?: string;
  fileName?: string;
};

function getEvolutionConfig(instance?: string) {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName =
    instance ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";

  if (!baseUrl || !apiKey || !instanceName) {
    throw new Error(
      "Evolution API is not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME."
    );
  }

  return { baseUrl, apiKey, instanceName };
}

export function isEvolutionConfigured(): boolean {
  return Boolean(
    process.env.EVOLUTION_API_URL?.trim() &&
      process.env.EVOLUTION_API_KEY?.trim() &&
      process.env.EVOLUTION_INSTANCE_NAME?.trim()
  );
}

export function normalizeWhatsAppRecipient(phoneDigits: string): string {
  return normalizePhoneDigits(phoneDigits);
}

function stripEmptyFields(
  payload: Record<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(payload).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].trim().length > 0
    )
  );
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function logEvolutionResponseBody(
  label: string,
  details: {
    endpoint: string;
    status: number;
    responseBody: string;
    payload: Record<string, unknown>;
  }
) {
  console.error("[EVOLUTION RESPONSE BODY]", {
    label,
    endpoint: details.endpoint,
    status: details.status,
    responseBody: details.responseBody,
    payload: details.payload,
  });
}

async function postEvolutionJson(
  endpoint: string,
  apiKey: string,
  payload: Record<string, string>
): Promise<EvolutionSendResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    logEvolutionResponseBody("request_failed", {
      endpoint,
      status: response.status,
      responseBody,
      payload,
    });

    return {
      success: false,
      status: response.status,
      endpoint,
      responseBody,
      error: `Evolution API request failed (${response.status}): ${responseBody}`,
    };
  }

  return {
    success: true,
    status: response.status,
    endpoint,
    responseBody,
  };
}

export async function sendWhatsAppTextSafe(
  phoneDigits: string,
  text: string,
  instance?: string
): Promise<EvolutionSendResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      success: false,
      error: "Cannot send empty WhatsApp text message.",
    };
  }

  let config;
  try {
    config = getEvolutionConfig(instance);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evolution not configured.";
    console.error("[WHATSAPP OUTBOUND FAILURE]", { kind: "text", reason: message });
    recordOutboundFailure({ kind: "text", reason: message, phoneDigits });
    return { success: false, error: message };
  }

  const endpoint = `${config.baseUrl}/message/sendText/${encodeURIComponent(config.instanceName)}`;
  const payload = stripEmptyFields({
    number: normalizeWhatsAppRecipient(phoneDigits),
    text: trimmed,
  });

  console.log("[WHATSAPP OUTBOUND TEXT]", {
    endpoint,
    number: payload.number,
    textLength: trimmed.length,
    preview: trimmed.slice(0, 120),
  });

  try {
    const result = await postEvolutionJson(endpoint, config.apiKey, payload);

    if (result.success) {
      console.log("[WHATSAPP OUTBOUND SUCCESS]", {
        kind: "text",
        endpoint,
        status: result.status,
      });
      recordOutboundSuccess({ kind: "text", phoneDigits, endpoint, status: result.status });
      return result;
    }

    console.error("[WHATSAPP OUTBOUND FAILURE]", {
      kind: "text",
      endpoint,
      status: result.status,
      reason: result.error,
    });
    recordOutboundFailure({
      kind: "text",
      phoneDigits,
      endpoint,
      status: result.status,
      reason: result.error,
    });
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network error sending text.";
    console.error("[WHATSAPP OUTBOUND FAILURE]", { kind: "text", endpoint, reason });
    recordOutboundFailure({ kind: "text", phoneDigits, endpoint, reason });
    return { success: false, endpoint, error: reason };
  }
}

export async function sendWhatsAppText(
  phoneDigits: string,
  text: string,
  instance?: string
): Promise<SendTextResult> {
  const result = await sendWhatsAppTextSafe(phoneDigits, text, instance);
  if (!result.success) {
    throw new Error(result.error ?? "Evolution API send failed.");
  }
  return { success: true, status: result.status };
}

export async function sendWhatsAppMediaSafe(
  phoneDigits: string,
  payload: SendMediaPayload,
  instance?: string
): Promise<EvolutionSendResult> {
  const mediaUrl = payload.media.trim();
  if (!mediaUrl) {
    return { success: false, error: "Cannot send media without a URL." };
  }

  let config;
  try {
    config = getEvolutionConfig(instance);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evolution not configured.";
    console.error("[WHATSAPP OUTBOUND FAILURE]", {
      kind: "image",
      reason: message,
      mediaUrl,
    });
    recordOutboundFailure({ kind: "image", reason: message, phoneDigits, mediaUrl });
    return { success: false, error: message };
  }

  const endpoint = `${config.baseUrl}/message/sendMedia/${encodeURIComponent(config.instanceName)}`;
  const number = normalizeWhatsAppRecipient(phoneDigits);

  const attempts: Record<string, string>[] = [
    stripEmptyFields({
      number,
      mediatype: payload.mediatype,
      media: mediaUrl,
      caption: payload.caption?.trim(),
      mimetype: payload.mimetype,
      fileName: payload.fileName,
    }),
    stripEmptyFields({
      number,
      mediatype: payload.mediatype,
      media: mediaUrl,
      caption: payload.caption?.trim(),
    }),
    stripEmptyFields({
      number,
      mediatype: payload.mediatype,
      media: mediaUrl,
    }),
  ];

  console.log("[WHATSAPP OUTBOUND IMAGE]", {
    endpoint,
    number,
    mediaUrl,
    mediatype: payload.mediatype,
    hasCaption: Boolean(payload.caption?.trim()),
  });

  let lastResult: EvolutionSendResult = {
    success: false,
    error: "Media send not attempted.",
  };

  for (const attemptPayload of attempts) {
    try {
      const result = await postEvolutionJson(endpoint, config.apiKey, attemptPayload);
      lastResult = result;

      if (result.success) {
        console.log("[WHATSAPP OUTBOUND SUCCESS]", {
          kind: "image",
          endpoint,
          status: result.status,
          mediaUrl,
        });
        recordOutboundSuccess({
          kind: "image",
          phoneDigits,
          endpoint,
          status: result.status,
          mediaUrl,
        });
        return result;
      }
    } catch (error) {
      lastResult = {
        success: false,
        endpoint,
        error: error instanceof Error ? error.message : "Network error sending media.",
      };
    }
  }

  console.error("[WHATSAPP OUTBOUND FAILURE]", {
    kind: "image",
    endpoint,
    status: lastResult.status,
    reason: lastResult.error,
    mediaUrl,
  });
  recordOutboundFailure({
    kind: "image",
    phoneDigits,
    endpoint,
    status: lastResult.status,
    reason: lastResult.error,
    mediaUrl,
  });

  return lastResult;
}

export async function sendWhatsAppMedia(
  phoneDigits: string,
  payload: SendMediaPayload,
  instance?: string
): Promise<SendTextResult> {
  const result = await sendWhatsAppMediaSafe(phoneDigits, payload, instance);
  if (!result.success) {
    throw new Error(result.error ?? "Evolution API media send failed.");
  }
  return { success: true, status: result.status };
}
