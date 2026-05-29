import {
  describeWhatsAppPhoneRouting,
  logWhatsAppPhoneRouting,
  normalizePhoneDigits,
} from "@/lib/phone/normalize";
import {
  classifyEvolutionSendOutcome,
  parseEvolutionSendResponse,
} from "@/lib/evolution/parse-evolution-response";
import {
  getEvolutionConnectionSnapshot,
  getPendingDeliveryDiagnosis,
} from "@/lib/evolution/evolution-instance";
import { recordOutboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";
import {
  recordOutboundFailure,
  recordOutboundSuccess,
} from "@/lib/evolution/outbound-health";
import {
  applyVerificationToSendResult,
  pollEvolutionMessageDelivery,
  resolveVerificationRemoteJid,
  type MessageDeliveryVerification,
} from "@/lib/evolution/message-delivery-verify";
import {
  buildSendTextPayloadVariants,
  getProductionSendTextFormatOrder,
  selectSendTextPayloadVariant,
  type SendTextFormat,
} from "@/lib/evolution/send-text-payload";

export type SendTextResult = {
  success: boolean;
  status?: number;
};

export type SendWhatsAppOptions = {
  instance?: string;
  remoteJid?: string | null;
  format?: SendTextFormat;
  skipConnectionCheck?: boolean;
  /** When true, only attempt the selected/single format (diagnostics). */
  disableFallback?: boolean;
  /** When true, skip post-send delivery polling. */
  disableDeliveryVerification?: boolean;
};

export type EvolutionSendResult = SendTextResult & {
  endpoint?: string;
  responseBody?: string;
  error?: string;
  destinationNumber?: string;
  evolutionMessageId?: string;
  deliveryKey?: string;
  deliveryStatus?: string;
  payloadFormat?: SendTextFormat;
  payload?: Record<string, unknown>;
  accepted?: boolean;
  pendingOnly?: boolean;
  deliveryConfirmed?: boolean;
  sentToWhatsApp?: boolean;
  warning?: string | null;
  instanceState?: string | null;
  deliveryVerification?: MessageDeliveryVerification | null;
  attempts?: Array<{
    format: SendTextFormat;
    endpoint?: string;
    status?: number;
    pendingOnly?: boolean;
    sentToWhatsApp?: boolean;
    evolutionMessageId?: string;
  }>;
  fallbackUsed?: boolean;
};

export type SendMediaPayload = {
  mediatype: "image" | "video" | "document";
  media: string;
  caption?: string;
  mimetype?: string;
  fileName?: string;
};

function resolveSendOptions(
  instanceOrOptions?: string | SendWhatsAppOptions
): SendWhatsAppOptions {
  if (typeof instanceOrOptions === "string") {
    return { instance: instanceOrOptions };
  }
  return instanceOrOptions ?? {};
}

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
  label: "request_success" | "request_failed" | "request_pending",
  details: {
    endpoint: string;
    status: number;
    responseBody: string;
    payload: Record<string, unknown>;
    parsed?: ReturnType<typeof parseEvolutionSendResponse>;
    destinationNumber?: string;
    payloadFormat?: SendTextFormat;
    outcome?: ReturnType<typeof classifyEvolutionSendOutcome>;
    instanceState?: string | null;
  }
) {
  const logFn =
    label === "request_failed" ? console.error : console.log;

  logFn("[EVOLUTION RESPONSE BODY]", {
    label,
    endpoint: details.endpoint,
    status: details.status,
    destinationNumber: details.destinationNumber ?? null,
    payloadFormat: details.payloadFormat ?? null,
    instanceState: details.instanceState ?? null,
    responseBody: details.responseBody,
    evolutionMessageId: details.parsed?.messageId ?? null,
    deliveryKey: details.parsed?.deliveryKey ?? null,
    deliveryStatus: details.parsed?.deliveryStatus ?? null,
    pendingOnly: details.outcome?.pendingOnly ?? null,
    deliveryConfirmed: details.outcome?.deliveryConfirmed ?? null,
    warning: details.outcome?.warning ?? null,
    payload: details.payload,
  });
}

function persistOutboundHeartbeat(input: {
  instanceName: string;
  success: boolean;
  kind: "text" | "image";
  destinationNumber: string;
  status?: number;
  responseBody?: string;
  parsed: ReturnType<typeof parseEvolutionSendResponse>;
  error?: string;
  outcome?: ReturnType<typeof classifyEvolutionSendOutcome>;
}) {
  void recordOutboundHeartbeat({
    instance: input.instanceName,
    last_phone: input.destinationNumber,
    last_message_id: input.parsed.messageId,
    last_evolution_message_id: input.parsed.messageId,
    last_delivery_key: input.parsed.deliveryKey,
    last_delivery_status: input.parsed.deliveryStatus,
    last_response_body: input.responseBody ?? null,
    last_processing_status: input.success
      ? input.outcome?.pendingOnly
        ? `${input.kind}_accepted_pending`
        : `${input.kind}_sent`
      : `${input.kind}_failed`,
    last_error: input.error ?? input.outcome?.warning ?? null,
  });
}

async function postEvolutionJson(
  endpoint: string,
  apiKey: string,
  payload: Record<string, unknown>,
  context: {
    instanceName: string;
    kind: "text" | "image";
    destinationNumber: string;
    payloadFormat?: SendTextFormat;
    instanceState?: string | null;
  }
): Promise<EvolutionSendResult> {
  console.log("[EVOLUTION SEND REQUEST]", {
    endpoint,
    payloadFormat: context.payloadFormat ?? null,
    instanceState: context.instanceState ?? null,
    destinationNumber: context.destinationNumber,
    payload,
  });

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
  const outcome = classifyEvolutionSendOutcome({
    httpOk: response.ok,
    parsed,
  });

  const baseResult: EvolutionSendResult = {
    success: response.ok,
    status: response.status,
    endpoint,
    responseBody,
    destinationNumber: context.destinationNumber,
    evolutionMessageId: parsed.messageId ?? undefined,
    deliveryKey: parsed.deliveryKey ?? undefined,
    deliveryStatus: parsed.deliveryStatus ?? undefined,
    payloadFormat: context.payloadFormat,
    payload,
    accepted: outcome.accepted,
    pendingOnly: outcome.pendingOnly,
    deliveryConfirmed: outcome.deliveryConfirmed,
    sentToWhatsApp: outcome.sentToWhatsApp,
    warning: outcome.warning,
    instanceState: context.instanceState ?? null,
  };

  if (!response.ok) {
    logEvolutionResponseBody("request_failed", {
      endpoint,
      status: response.status,
      responseBody,
      payload,
      parsed,
      destinationNumber: context.destinationNumber,
      payloadFormat: context.payloadFormat,
      outcome,
      instanceState: context.instanceState,
    });

    const error = `Evolution API request failed (${response.status}): ${responseBody}`;

    persistOutboundHeartbeat({
      instanceName: context.instanceName,
      success: false,
      kind: context.kind,
      destinationNumber: context.destinationNumber,
      status: response.status,
      responseBody,
      parsed,
      error,
      outcome,
    });

    return { ...baseResult, error };
  }

  logEvolutionResponseBody(
    outcome.pendingOnly ? "request_pending" : "request_success",
    {
      endpoint,
      status: response.status,
      responseBody,
      payload,
      parsed,
      destinationNumber: context.destinationNumber,
      payloadFormat: context.payloadFormat,
      outcome,
      instanceState: context.instanceState,
    }
  );

  logOutboundDebug({
    phase: outcome.pendingOnly ? "send_pending" : "send_response",
    targetPhone: context.destinationNumber,
    normalizedPhone: normalizePhoneDigits(context.destinationNumber),
    payload,
    payloadFormat: context.payloadFormat,
    endpoint,
    httpStatus: response.status,
    responseBody,
    evolutionMessageId: parsed.messageId,
    deliveryStatus: parsed.deliveryStatus,
    instanceState: context.instanceState ?? null,
  });

  persistOutboundHeartbeat({
    instanceName: context.instanceName,
    success: true,
    kind: context.kind,
    destinationNumber: context.destinationNumber,
    status: response.status,
    responseBody,
    parsed,
    outcome,
  });

  return baseResult;
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

function recordTextOutcome(
  phoneDigits: string,
  destinationNumber: string,
  result: EvolutionSendResult
) {
  if (!result.success) {
    recordOutboundFailure({
      kind: "text",
      reason: result.error ?? result.warning ?? "Text send failed.",
      ...buildOutboundHealthFields(phoneDigits, destinationNumber, result),
    });
    return;
  }

  if (result.sentToWhatsApp) {
    recordOutboundSuccess({
      kind: "text",
      ...buildOutboundHealthFields(phoneDigits, destinationNumber, result),
    });
    return;
  }

  if (result.pendingOnly) {
    recordOutboundFailure({
      kind: "text",
      reason: result.warning ?? "Evolution accepted message but status is PENDING.",
      ...buildOutboundHealthFields(phoneDigits, destinationNumber, result),
    });
    return;
  }

  recordOutboundSuccess({
    kind: "text",
    ...buildOutboundHealthFields(phoneDigits, destinationNumber, result),
  });
}

function logOutboundDebug(details: {
  phase: string;
  targetPhone: string;
  normalizedPhone: string;
  remoteJid?: string | null;
  payload?: Record<string, unknown>;
  payloadFormat?: SendTextFormat;
  endpoint?: string;
  httpStatus?: number;
  responseBody?: string;
  evolutionMessageId?: string | null;
  deliveryStatus?: string | null;
  instanceName?: string;
  instanceState?: string | null;
  verification?: MessageDeliveryVerification | null;
}) {
  console.log("[WHATSAPP OUTBOUND DEBUG]", details);
}

async function executeTextSendAttempt(input: {
  config: ReturnType<typeof getEvolutionConfig>;
  phoneDigits: string;
  text: string;
  remoteJid?: string | null;
  format: SendTextFormat;
  connectionState?: string | null;
}): Promise<EvolutionSendResult> {
  const selected = selectSendTextPayloadVariant({
    phoneDigits: input.phoneDigits,
    text: input.text,
    remoteJid: input.remoteJid,
    format: input.format,
  });

  const destinationNumber = String(
    selected.payload.number ?? normalizeWhatsAppRecipient(input.phoneDigits)
  );

  const endpoint = `${input.config.baseUrl}/message/sendText/${encodeURIComponent(input.config.instanceName)}`;

  logOutboundDebug({
    phase: "send_attempt",
    targetPhone: input.phoneDigits,
    normalizedPhone: normalizeWhatsAppRecipient(input.phoneDigits),
    remoteJid: input.remoteJid ?? null,
    payload: selected.payload,
    payloadFormat: selected.format,
    endpoint,
    instanceName: input.config.instanceName,
    instanceState: input.connectionState ?? null,
  });

  return postEvolutionJson(endpoint, input.config.apiKey, selected.payload, {
    instanceName: input.config.instanceName,
    kind: "text",
    destinationNumber,
    payloadFormat: selected.format,
    instanceState: input.connectionState ?? null,
  });
}

async function verifyAndEnhanceTextResult(input: {
  result: EvolutionSendResult;
  phoneDigits: string;
  remoteJid?: string | null;
  instanceName: string;
  disableDeliveryVerification?: boolean;
}): Promise<EvolutionSendResult> {
  const result = { ...input.result };

  if (
    input.disableDeliveryVerification ||
    !result.success ||
    !result.evolutionMessageId
  ) {
    return result;
  }

  const verificationJid = resolveVerificationRemoteJid({
    remoteJid: input.remoteJid,
    phoneDigits: input.phoneDigits,
    deliveryKey: result.deliveryKey,
    destinationNumber: result.destinationNumber,
  });

  const verification = await pollEvolutionMessageDelivery({
    messageId: result.evolutionMessageId,
    remoteJid: verificationJid,
    instanceName: input.instanceName,
  });

  applyVerificationToSendResult(result, verification);
  result.deliveryVerification = verification;

  logOutboundDebug({
    phase: "delivery_verify",
    targetPhone: input.phoneDigits,
    normalizedPhone: normalizeWhatsAppRecipient(input.phoneDigits),
    remoteJid: input.remoteJid ?? null,
    endpoint: verification.endpoint ?? result.endpoint,
    evolutionMessageId: result.evolutionMessageId ?? null,
    deliveryStatus: result.deliveryStatus ?? null,
    instanceName: input.instanceName,
    verification,
  });

  return result;
}

export async function sendWhatsAppTextSafe(
  phoneDigits: string,
  text: string,
  instanceOrOptions?: string | SendWhatsAppOptions
): Promise<EvolutionSendResult> {
  const options = resolveSendOptions(instanceOrOptions);
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      success: false,
      error: "Cannot send empty WhatsApp text message.",
    };
  }

  let config;
  try {
    config = getEvolutionConfig(options.instance);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evolution not configured.";
    console.error("[WHATSAPP OUTBOUND FAILURE]", { kind: "text", reason: message });
    recordOutboundFailure({ kind: "text", reason: message, phoneDigits });
    return { success: false, error: message };
  }

  const connection = options.skipConnectionCheck
    ? null
    : await getEvolutionConnectionSnapshot(config.instanceName);

  if (connection) {
    console.log("[EVOLUTION INSTANCE STATE]", {
      endpoint: connection.endpoint,
      state: connection.state,
      interpretation: connection.interpretation,
      instanceName: config.instanceName,
      baseUrl: config.baseUrl,
      hasApiKey: Boolean(config.apiKey),
    });
  }

  const phoneContext = describeWhatsAppPhoneRouting({
    remoteJid: options.remoteJid,
    inboundPhoneDigits: phoneDigits,
    outboundPhoneInput: phoneDigits,
  });
  logWhatsAppPhoneRouting("outbound_text", phoneContext);

  const allVariants = buildSendTextPayloadVariants({
    phoneDigits,
    text: trimmed,
    remoteJid: options.remoteJid,
  });

  const formatOrder = options.format
    ? [options.format]
    : options.disableFallback
      ? [selectSendTextPayloadVariant({
          phoneDigits,
          text: trimmed,
          remoteJid: options.remoteJid,
        }).format]
      : getProductionSendTextFormatOrder(options.remoteJid).filter((format) =>
          allVariants.some((variant) => variant.format === format)
        );

  const attempts: EvolutionSendResult["attempts"] = [];
  let lastResult: EvolutionSendResult = {
    success: false,
    error: "No send attempt executed.",
  };

  try {
    for (let index = 0; index < formatOrder.length; index += 1) {
      const format = formatOrder[index]!;
      const isFallback = index > 0;

      if (isFallback) {
        console.warn("[WHATSAPP OUTBOUND FALLBACK]", {
          previousFormat: formatOrder[index - 1],
          nextFormat: format,
          previousStatus: lastResult.deliveryStatus ?? null,
          previousMessageId: lastResult.evolutionMessageId ?? null,
        });
      }

      let result = await executeTextSendAttempt({
        config,
        phoneDigits,
        text: trimmed,
        remoteJid: options.remoteJid,
        format,
        connectionState: connection?.state ?? null,
      });

      result = await verifyAndEnhanceTextResult({
        result,
        phoneDigits,
        remoteJid: options.remoteJid,
        instanceName: config.instanceName,
        disableDeliveryVerification: options.disableDeliveryVerification,
      });

      attempts.push({
        format,
        endpoint: result.endpoint,
        status: result.status,
        pendingOnly: result.pendingOnly,
        sentToWhatsApp: result.sentToWhatsApp,
        evolutionMessageId: result.evolutionMessageId,
      });

      lastResult = {
        ...result,
        attempts,
        fallbackUsed: isFallback,
      };

      if (result.sentToWhatsApp) {
        console.log("[WHATSAPP OUTBOUND SUCCESS]", {
          kind: "text",
          payloadFormat: format,
          destinationNumber: result.destinationNumber,
          evolutionMessageId: result.evolutionMessageId ?? null,
          deliveryStatus: result.deliveryStatus ?? null,
          fallbackUsed: isFallback,
        });
        recordTextOutcome(phoneDigits, result.destinationNumber ?? phoneDigits, lastResult);
        return lastResult;
      }

      if (!result.success) {
        continue;
      }

      if (result.pendingOnly && index < formatOrder.length - 1 && !options.disableFallback) {
        continue;
      }

      break;
    }

    if (lastResult.success && lastResult.pendingOnly) {
      console.warn("[WHATSAPP OUTBOUND PENDING]", {
        kind: "text",
        attempts,
        warning: lastResult.warning,
        diagnosis: getPendingDeliveryDiagnosis(),
      });
    } else if (!lastResult.success) {
      console.error("[WHATSAPP OUTBOUND FAILURE]", {
        kind: "text",
        attempts,
        reason: lastResult.error,
      });
    }

    recordTextOutcome(
      phoneDigits,
      lastResult.destinationNumber ?? phoneDigits,
      lastResult
    );
    return lastResult;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network error sending text.";
    console.error("[WHATSAPP OUTBOUND FAILURE]", { kind: "text", reason });
    recordOutboundFailure({ kind: "text", phoneDigits, reason });
    return { success: false, error: reason, attempts };
  }
}

export async function sendWhatsAppText(
  phoneDigits: string,
  text: string,
  instanceOrOptions?: string | SendWhatsAppOptions
): Promise<SendTextResult> {
  const result = await sendWhatsAppTextSafe(phoneDigits, text, instanceOrOptions);
  if (!result.success) {
    throw new Error(result.error ?? "Evolution API send failed.");
  }
  if (result.pendingOnly) {
    throw new Error(
      result.warning ??
        "Evolution accepted the message but WhatsApp delivery is still PENDING."
    );
  }
  return { success: true, status: result.status };
}

export async function runEvolutionSendTextDiagnostic(input: {
  phoneDigits: string;
  text: string;
  format?: SendTextFormat | "all";
  remoteJid?: string | null;
  dryRun?: boolean;
}): Promise<{
  configured: boolean;
  connection: Awaited<ReturnType<typeof getEvolutionConnectionSnapshot>>;
  variants: ReturnType<typeof buildSendTextPayloadVariants>;
  selectedFormat: SendTextFormat;
  sendResult: EvolutionSendResult | null;
  compareResults: EvolutionSendResult[] | null;
}> {
  const configured = isEvolutionConfigured();
  const connection = configured
    ? await getEvolutionConnectionSnapshot()
    : null;

  const variants = buildSendTextPayloadVariants({
    phoneDigits: input.phoneDigits,
    text: input.text,
    remoteJid: input.remoteJid,
  });

  const selectedFormat =
    input.format && input.format !== "all"
      ? input.format
      : resolvePreferredFromVariants(input.remoteJid);

  if (input.dryRun || !configured) {
    return {
      configured,
      connection,
      variants,
      selectedFormat,
      sendResult: null,
      compareResults: null,
    };
  }

  if (input.format === "all") {
    const compareResults: EvolutionSendResult[] = [];
    for (const variant of variants) {
      const result = await sendWhatsAppTextSafe(input.phoneDigits, input.text, {
        remoteJid: input.remoteJid,
        format: variant.format,
        skipConnectionCheck: compareResults.length > 0,
        disableFallback: true,
      });
      compareResults.push(result);
    }

    return {
      configured,
      connection,
      variants,
      selectedFormat,
      sendResult: compareResults[0] ?? null,
      compareResults,
    };
  }

  const sendResult = await sendWhatsAppTextSafe(input.phoneDigits, input.text, {
    remoteJid: input.remoteJid,
    format: selectedFormat,
    disableFallback: true,
  });

  return {
    configured,
    connection,
    variants,
    selectedFormat,
    sendResult,
    compareResults: null,
  };
}

function resolvePreferredFromVariants(
  _remoteJid?: string | null
): SendTextFormat {
  return "digits";
}

export async function sendWhatsAppMediaSafe(
  phoneDigits: string,
  payload: SendMediaPayload,
  instanceOrOptions?: string | SendWhatsAppOptions
): Promise<EvolutionSendResult> {
  const options = resolveSendOptions(instanceOrOptions);
  const mediaUrl = payload.media.trim();

  if (!mediaUrl) {
    return { success: false, error: "Cannot send media without a URL." };
  }

  let config;
  try {
    config = getEvolutionConfig(options.instance);
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

  const connection = options.skipConnectionCheck
    ? null
    : await getEvolutionConnectionSnapshot(config.instanceName);

  const endpoint = `${config.baseUrl}/message/sendMedia/${encodeURIComponent(config.instanceName)}`;
  const digits = normalizeWhatsAppRecipient(phoneDigits);
  const destinationNumber = options.remoteJid?.includes("@")
    ? options.remoteJid
    : digits;

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
      number: digits,
      mediatype: payload.mediatype,
      media: mediaUrl,
      caption: payload.caption?.trim(),
    }),
    stripEmptyFields({
      number: digits,
      mediatype: payload.mediatype,
      media: mediaUrl,
    }),
  ];

  logWhatsAppPhoneRouting(
    "outbound_media",
    describeWhatsAppPhoneRouting({
      remoteJid: options.remoteJid,
      inboundPhoneDigits: phoneDigits,
      outboundPhoneInput: destinationNumber,
    })
  );

  console.log("[WHATSAPP OUTBOUND IMAGE]", {
    endpoint,
    number: destinationNumber,
    destinationNumber,
    mediaUrl,
    mediatype: payload.mediatype,
    hasCaption: Boolean(payload.caption?.trim()),
    instanceState: connection?.state ?? null,
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
          destinationNumber,
          instanceState: connection?.state ?? null,
        }
      );
      lastResult = result;

      if (result.success && !result.pendingOnly) {
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

      if (result.success && result.pendingOnly) {
        break;
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
    reason: lastResult.error ?? lastResult.warning,
    responseBody: lastResult.responseBody ?? null,
    mediaUrl,
  });
  recordOutboundFailure({
    kind: "image",
    reason: lastResult.error ?? lastResult.warning ?? "Media send failed.",
    mediaUrl,
    ...buildOutboundHealthFields(phoneDigits, destinationNumber, lastResult),
  });

  return lastResult;
}

export async function sendWhatsAppMedia(
  phoneDigits: string,
  payload: SendMediaPayload,
  instanceOrOptions?: string | SendWhatsAppOptions
): Promise<SendTextResult> {
  const result = await sendWhatsAppMediaSafe(phoneDigits, payload, instanceOrOptions);
  if (!result.success) {
    throw new Error(result.error ?? "Evolution API media send failed.");
  }
  if (result.pendingOnly) {
    throw new Error(
      result.warning ??
        "Evolution accepted the media message but WhatsApp delivery is still PENDING."
    );
  }
  return { success: true, status: result.status };
}

export {
  buildSendTextPayloadVariants,
  getProductionSendTextFormatOrder,
  type SendTextFormat,
} from "@/lib/evolution/send-text-payload";
