import {
  describeWhatsAppPhoneRouting,
  logWhatsAppPhoneRouting,
  normalizePhoneDigits,
} from "@/lib/phone/normalize";
import {
  parseEvolutionSendResponse,
} from "@/lib/evolution/parse-evolution-response";
import { recordOutboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";
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
  destinationNumber?: string;
  evolutionMessageId?: string;
  deliveryKey?: string;
  deliveryStatus?: string;
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
  label: "request_success" | "request_failed",
  details: {
    endpoint: string;
    status: number;
    responseBody: string;
    payload: Record<string, unknown>;
    parsed?: ReturnType<typeof parseEvolutionSendResponse>;
    destinationNumber?: string;
  }
) {
  const logFn = label === "request_success" ? console.log : console.error;
  logFn("[EVOLUTION RESPONSE BODY]", {
    label,
    endpoint: details.endpoint,
    status: details.status,
    destinationNumber: details.destinationNumber ?? null,
    responseBody: details.responseBody,
    evolutionMessageId: details.parsed?.messageId ?? null,
    deliveryKey: details.parsed?.deliveryKey ?? null,
    deliveryStatus: details.parsed?.deliveryStatus ?? null,
    payload: details.payload,
  });
}

async function persistOutboundHeartbeat(input: {
  instanceName: string;
  success: boolean;
  kind: "text" | "image";
  destinationNumber: string;
  phoneDigits: string;
  status?: number;
  responseBody?: string;
  parsed: ReturnType<typeof parseEvolutionSendResponse>;
  error?: string;
}) {
  void recordOutboundHeartbeat({
    instance: input.instanceName,
    last_phone: input.destinationNumber,
    last_message_id: input.parsed.messageId,
    last_evolution_message_id: input.parsed.messageId,
    last_delivery_key: input.parsed.deliveryKey,
    last_delivery_status: input.parsed.deliveryStatus,
    last_response_body: input.responseBody ?? null,
    last_processing_status: input.success ? `${input.kind}_sent` : `${input.kind}_failed`,
    last_error: input.error ?? null,
  });
}

async function postEvolutionJson(
  endpoint: string,
  apiKey: string,
  payload: Record<string, string>,
  context: {
    instanceName: string;
    kind: "text" | "image";
    phoneDigits: string;
    destinationNumber: string;
  }
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
  const parsed = parseEvolutionSendResponse(responseBody);

  if (!response.ok) {
    logEvolutionResponseBody("request_failed", {
      endpoint,
      status: response.status,
      responseBody,
      payload,
      parsed,
      destinationNumber: context.destinationNumber,
    });

    const error = `Evolution API request failed (${response.status}): ${responseBody}`;

    void persistOutboundHeartbeat({
      instanceName: context.instanceName,
      success: false,
      kind: context.kind,
      destinationNumber: context.destinationNumber,
      phoneDigits: context.phoneDigits,
      status: response.status,
      responseBody,
      parsed,
      error,
    });

    return {
      success: false,
      status: response.status,
      endpoint,
      responseBody,
      destinationNumber: context.destinationNumber,
      evolutionMessageId: parsed.messageId ?? undefined,
      deliveryKey: parsed.deliveryKey ?? undefined,
      deliveryStatus: parsed.deliveryStatus ?? undefined,
      error,
    };
  }

  logEvolutionResponseBody("request_success", {
    endpoint,
    status: response.status,
    responseBody,
    payload,
    parsed,
    destinationNumber: context.destinationNumber,
  });

  void persistOutboundHeartbeat({
    instanceName: context.instanceName,
    success: true,
    kind: context.kind,
    destinationNumber: context.destinationNumber,
    phoneDigits: context.phoneDigits,
    status: response.status,
    responseBody,
    parsed,
  });

  return {
    success: true,
    status: response.status,
    endpoint,
    responseBody,
    destinationNumber: context.destinationNumber,
    evolutionMessageId: parsed.messageId ?? undefined,
    deliveryKey: parsed.deliveryKey ?? undefined,
    deliveryStatus: parsed.deliveryStatus ?? undefined,
  };
}

function buildOutboundHealthFields(
  phoneDigits: string,
  destinationNumber: string,
  result: EvolutionSendResult
) {
  return {
    phoneDigits,
    destinationNumber,
    rawPhoneInput: phoneDigits,
    endpoint: result.endpoint,
    status: result.status,
    responseBody: result.responseBody,
    evolutionMessageId: result.evolutionMessageId,
    deliveryKey: result.deliveryKey,
    deliveryStatus: result.deliveryStatus,
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
  const destinationNumber = normalizeWhatsAppRecipient(phoneDigits);
  const payload = stripEmptyFields({
    number: destinationNumber,
    text: trimmed,
  });

  const phoneContext = describeWhatsAppPhoneRouting({
    outboundPhoneInput: phoneDigits,
  });
  logWhatsAppPhoneRouting("outbound_text", phoneContext);

  console.log("[WHATSAPP OUTBOUND TEXT]", {
    endpoint,
    number: payload.number,
    destinationNumber,
    textLength: trimmed.length,
    preview: trimmed.slice(0, 120),
  });

  try {
    const result = await postEvolutionJson(endpoint, config.apiKey, payload, {
      instanceName: config.instanceName,
      kind: "text",
      phoneDigits,
      destinationNumber,
    });

    if (result.success) {
      console.log("[WHATSAPP OUTBOUND SUCCESS]", {
        kind: "text",
        endpoint,
        status: result.status,
        destinationNumber,
        evolutionMessageId: result.evolutionMessageId ?? null,
        deliveryKey: result.deliveryKey ?? null,
        deliveryStatus: result.deliveryStatus ?? null,
        responseBody: result.responseBody ?? null,
      });
      recordOutboundSuccess({
        kind: "text",
        ...buildOutboundHealthFields(phoneDigits, destinationNumber, result),
      });
      return result;
    }

    console.error("[WHATSAPP OUTBOUND FAILURE]", {
      kind: "text",
      endpoint,
      status: result.status,
      destinationNumber,
      evolutionMessageId: result.evolutionMessageId ?? null,
      reason: result.error,
      responseBody: result.responseBody ?? null,
    });
    recordOutboundFailure({
      kind: "text",
      reason: result.error,
      ...buildOutboundHealthFields(phoneDigits, destinationNumber, result),
    });
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network error sending text.";
    console.error("[WHATSAPP OUTBOUND FAILURE]", {
      kind: "text",
      endpoint,
      destinationNumber,
      reason,
    });
    recordOutboundFailure({
      kind: "text",
      phoneDigits,
      destinationNumber,
      endpoint,
      reason,
    });
    return { success: false, endpoint, destinationNumber, error: reason };
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
  const destinationNumber = normalizeWhatsAppRecipient(phoneDigits);

  const attempts: Record<string, string>[] = [
    stripEmptyFields({
      number: destinationNumber,
      mediatype: payload.mediatype,
      media: mediaUrl,
      caption: payload.caption?.trim(),
      mimetype: payload.mimetype,
      fileName: payload.fileName,
    }),
    stripEmptyFields({
      number: destinationNumber,
      mediatype: payload.mediatype,
      media: mediaUrl,
      caption: payload.caption?.trim(),
    }),
    stripEmptyFields({
      number: destinationNumber,
      mediatype: payload.mediatype,
      media: mediaUrl,
    }),
  ];

  logWhatsAppPhoneRouting(
    "outbound_media",
    describeWhatsAppPhoneRouting({ outboundPhoneInput: phoneDigits })
  );

  console.log("[WHATSAPP OUTBOUND IMAGE]", {
    endpoint,
    number: destinationNumber,
    destinationNumber,
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
      const result = await postEvolutionJson(
        endpoint,
        config.apiKey,
        attemptPayload,
        {
          instanceName: config.instanceName,
          kind: "image",
          phoneDigits,
          destinationNumber,
        }
      );
      lastResult = result;

      if (result.success) {
        console.log("[WHATSAPP OUTBOUND SUCCESS]", {
          kind: "image",
          endpoint,
          status: result.status,
          destinationNumber,
          evolutionMessageId: result.evolutionMessageId ?? null,
          deliveryKey: result.deliveryKey ?? null,
          deliveryStatus: result.deliveryStatus ?? null,
          responseBody: result.responseBody ?? null,
          mediaUrl,
        });
        recordOutboundSuccess({
          kind: "image",
          mediaUrl,
          ...buildOutboundHealthFields(phoneDigits, destinationNumber, result),
        });
        return result;
      }
    } catch (error) {
      lastResult = {
        success: false,
        endpoint,
        destinationNumber,
        error: error instanceof Error ? error.message : "Network error sending media.",
      };
    }
  }

  console.error("[WHATSAPP OUTBOUND FAILURE]", {
    kind: "image",
    endpoint,
    status: lastResult.status,
    destinationNumber,
    evolutionMessageId: lastResult.evolutionMessageId ?? null,
    reason: lastResult.error,
    responseBody: lastResult.responseBody ?? null,
    mediaUrl,
  });
  recordOutboundFailure({
    kind: "image",
    reason: lastResult.error,
    mediaUrl,
    ...buildOutboundHealthFields(phoneDigits, destinationNumber, lastResult),
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
