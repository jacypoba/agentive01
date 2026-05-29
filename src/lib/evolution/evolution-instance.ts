export type EvolutionFetchResult = {
  ok: boolean;
  status: number;
  endpoint: string;
  body: string;
  json: unknown;
};

export type EvolutionConnectionSnapshot = {
  ok: boolean;
  status: number;
  endpoint: string;
  state: string | null;
  raw: unknown;
  interpretation: string | null;
};

function getEvolutionBaseConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "") ?? null;
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? null;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? null;
  return { baseUrl, apiKey, instanceName };
}

export async function evolutionGet(
  path: string,
  instanceName?: string
): Promise<EvolutionFetchResult | null> {
  const config = getEvolutionBaseConfig();
  if (!config.baseUrl || !config.apiKey) {
    return null;
  }

  const resolvedInstance = instanceName ?? config.instanceName;
  const resolvedPath = resolvedInstance
    ? path.replace("{instance}", encodeURIComponent(resolvedInstance))
    : path;
  const endpoint = `${config.baseUrl}${resolvedPath}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: config.apiKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const body = await response.text();
    let json: unknown = null;

    try {
      json = body ? JSON.parse(body) : null;
    } catch {
      json = body;
    }

    return {
      ok: response.ok,
      status: response.status,
      endpoint,
      body,
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

function extractConnectionState(json: unknown): string | null {
  if (!json || typeof json !== "object") {
    return null;
  }

  const record = json as Record<string, unknown>;

  if (typeof record.state === "string") {
    return record.state;
  }

  if (record.instance && typeof record.instance === "object") {
    const instance = record.instance as Record<string, unknown>;
    if (typeof instance.state === "string") {
      return instance.state;
    }
    if (typeof instance.status === "string") {
      return instance.status;
    }
  }

  return null;
}

function interpretConnectionState(state: string | null): string | null {
  if (!state) {
    return "Could not read Evolution connection state.";
  }

  const normalized = state.toLowerCase();

  if (normalized === "open") {
    return "Instance reports open. If outbound stays PENDING, restart the instance after reconnect.";
  }

  if (normalized === "close" || normalized === "closed") {
    return "Instance is disconnected — outbound messages will not deliver.";
  }

  if (normalized === "connecting") {
    return "Instance is still connecting — wait before sending.";
  }

  return `Instance state is "${state}".`;
}

export async function getEvolutionConnectionSnapshot(
  instanceName?: string
): Promise<EvolutionConnectionSnapshot | null> {
  const result = await evolutionGet("/instance/connectionState/{instance}", instanceName);
  if (!result) {
    return null;
  }

  const state = extractConnectionState(result.json);

  return {
    ok: result.ok,
    status: result.status,
    endpoint: result.endpoint,
    state,
    raw: result.json,
    interpretation: interpretConnectionState(state),
  };
}

export function getEvolutionRestartHint(instanceName?: string): string {
  const config = getEvolutionBaseConfig();
  const instance = instanceName ?? config.instanceName ?? "{instance}";
  const baseUrl = config.baseUrl ?? "https://your-evolution-host";

  return `POST ${baseUrl}/instance/restart/${encodeURIComponent(instance)} (requires apikey header). Restart after QR reconnect if outbound stays PENDING.`;
}

export function getPendingDeliveryDiagnosis(): string[] {
  return [
    "HTTP 201 with status PENDING means Evolution queued the message locally — not that WhatsApp delivered it.",
    "After reconnecting WhatsApp, restart the Evolution instance so Baileys resyncs the session.",
    "Reply using the inbound remoteJid (e.g. 393479896685@s.whatsapp.net) when available — digits-only can stall on some builds.",
    "A restricted or flagged WhatsApp account may accept sends but never advance past PENDING.",
    "Enable MESSAGES_UPDATE webhooks and confirm status moves to SERVER_ACK / DELIVERED.",
  ];
}
