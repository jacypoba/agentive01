import {
  mapEvolutionDeliveryStatus,
} from "@/lib/evolution/parse-evolution-response";

export type MessageDeliveryVerification = {
  checked: boolean;
  endpoint: string | null;
  status: string | null;
  sentToWhatsApp: boolean;
  stillPending: boolean;
  raw: unknown;
  error: string | null;
};

function getEvolutionPostConfig(instanceName?: string) {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "") ?? null;
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? null;
  const instance = instanceName ?? process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? null;
  return { baseUrl, apiKey, instance };
}

async function evolutionPost(
  path: string,
  body: Record<string, unknown>,
  instanceName?: string
): Promise<{ ok: boolean; status: number; endpoint: string; body: string; json: unknown } | null> {
  const config = getEvolutionPostConfig(instanceName);
  if (!config.baseUrl || !config.apiKey || !config.instance) {
    return null;
  }

  const endpoint = `${config.baseUrl}${path.replace("{instance}", encodeURIComponent(config.instance))}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    return {
      ok: response.ok,
      status: response.status,
      endpoint,
      body: text,
      json,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      endpoint,
      body: error instanceof Error ? error.message : "Network error",
      json: null,
    };
  }
}

function extractStatusFromFindResult(json: unknown): string | null {
  if (!json) {
    return null;
  }

  const records = Array.isArray(json)
    ? json
    : typeof json === "object" && json !== null && Array.isArray((json as { messages?: unknown }).messages)
      ? ((json as { messages: unknown[] }).messages ?? [])
      : typeof json === "object" && json !== null && Array.isArray((json as { data?: unknown }).data)
        ? ((json as { data: unknown[] }).data ?? [])
        : [json];

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const item = record as Record<string, unknown>;
    const status =
      item.status ??
      item.messageStatus ??
      (item.update && typeof item.update === "object"
        ? (item.update as Record<string, unknown>).status
        : null);

    const mapped = mapEvolutionDeliveryStatus(status);
    if (mapped) {
      return mapped;
    }
  }

  return null;
}

const CONFIRMED = new Set(["SERVER_ACK", "DELIVERED", "READ", "PLAYED", "2", "3", "4", "5"]);

function isConfirmedStatus(status: string | null): boolean {
  return Boolean(status && CONFIRMED.has(status.toUpperCase()));
}

/** Best-effort post-send status lookup via Evolution chat endpoints. */
export async function verifyEvolutionMessageDelivery(input: {
  messageId: string;
  remoteJid: string;
  instanceName?: string;
}): Promise<MessageDeliveryVerification> {
  const empty: MessageDeliveryVerification = {
    checked: false,
    endpoint: null,
    status: null,
    sentToWhatsApp: false,
    stillPending: false,
    raw: null,
    error: null,
  };

  if (!input.messageId || !input.remoteJid) {
    return { ...empty, error: "Missing messageId or remoteJid for verification." };
  }

  const findMessages = await evolutionPost(
    "/chat/findMessages/{instance}",
    {
      where: {
        key: {
          id: input.messageId,
          remoteJid: input.remoteJid,
          fromMe: true,
        },
      },
      limit: 1,
    },
    input.instanceName
  );

  if (findMessages) {
    const status = extractStatusFromFindResult(findMessages.json);
    if (status) {
      return {
        checked: true,
        endpoint: findMessages.endpoint,
        status,
        sentToWhatsApp: isConfirmedStatus(status),
        stillPending: status === "PENDING" || status === "1",
        raw: findMessages.json,
        error: findMessages.ok ? null : findMessages.body,
      };
    }
  }

  const findStatus = await evolutionPost(
    "/chat/findStatusMessage/{instance}",
    {
      where: {
        id: input.messageId,
        remoteJid: input.remoteJid,
        fromMe: true,
      },
      page: 1,
      offset: 10,
    },
    input.instanceName
  );

  if (findStatus) {
    const status = extractStatusFromFindResult(findStatus.json);
    return {
      checked: true,
      endpoint: findStatus.endpoint,
      status,
      sentToWhatsApp: isConfirmedStatus(status),
      stillPending: status === "PENDING" || status === "1" || !status,
      raw: findStatus.json,
      error: findStatus.ok ? null : findStatus.body,
    };
  }

  return { ...empty, error: "Evolution API not configured for delivery verification." };
}

export async function pollEvolutionMessageDelivery(input: {
  messageId: string;
  remoteJid: string;
  instanceName?: string;
  attempts?: number;
  delayMs?: number;
}): Promise<MessageDeliveryVerification> {
  const attempts = input.attempts ?? 3;
  const delayMs = input.delayMs ?? 1500;

  let last: MessageDeliveryVerification = {
    checked: false,
    endpoint: null,
    status: null,
    sentToWhatsApp: false,
    stillPending: true,
    raw: null,
    error: "Verification not run.",
  };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    last = await verifyEvolutionMessageDelivery(input);

    console.log("[EVOLUTION DELIVERY VERIFY]", {
      attempt,
      messageId: input.messageId,
      remoteJid: input.remoteJid,
      status: last.status,
      sentToWhatsApp: last.sentToWhatsApp,
      stillPending: last.stillPending,
      endpoint: last.endpoint,
    });

    if (last.sentToWhatsApp) {
      return last;
    }

    if (!last.stillPending && last.status && last.status !== "PENDING") {
      return last;
    }
  }

  return last;
}

export function resolveVerificationRemoteJid(input: {
  remoteJid?: string | null;
  phoneDigits: string;
  deliveryKey?: string | null;
  destinationNumber?: string | null;
}): string {
  if (input.remoteJid?.includes("@")) {
    return input.remoteJid.trim();
  }

  if (input.deliveryKey?.includes("@")) {
    return input.deliveryKey.trim();
  }

  if (input.destinationNumber?.includes("@")) {
    return input.destinationNumber.trim();
  }

  const digits = input.phoneDigits.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export function applyVerificationToSendResult(
  result: {
    deliveryStatus?: string;
    sentToWhatsApp?: boolean;
    pendingOnly?: boolean;
    deliveryConfirmed?: boolean;
    warning?: string | null;
  },
  verification: MessageDeliveryVerification
) {
  if (!verification.checked || !verification.status) {
    return;
  }

  result.deliveryStatus = verification.status;

  if (verification.sentToWhatsApp) {
    result.sentToWhatsApp = true;
    result.pendingOnly = false;
    result.deliveryConfirmed = true;
    result.warning = null;
    return;
  }

  if (verification.stillPending) {
    result.pendingOnly = true;
    result.sentToWhatsApp = false;
    result.deliveryConfirmed = false;
    result.warning =
      "Evolution accepted the message but delivery verification still shows PENDING.";
  }
}
