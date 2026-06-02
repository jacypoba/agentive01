import "server-only";
import { getInboundHeartbeat } from "@/lib/evolution/whatsapp-heartbeat";
import { buildExpectedWebhookUrl } from "@/lib/evolution/evolution-webhook-sync";
import { getAppUrl } from "@/lib/stripe/app-url";

type EvolutionFetchResult = {
  ok: boolean;
  status: number;
  endpoint: string;
  body: string;
  json: unknown;
};

async function evolutionFetch(
  baseUrl: string,
  apiKey: string,
  path: string
): Promise<EvolutionFetchResult> {
  const endpoint = `${baseUrl}${path}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: apiKey,
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

function extractConfiguredWebhook(json: unknown): {
  url: string | null;
  enabled: boolean | null;
  events: string[] | null;
} {
  if (!json || typeof json !== "object") {
    return { url: null, enabled: null, events: null };
  }

  const record = json as Record<string, unknown>;
  const webhook =
    record.webhook && typeof record.webhook === "object"
      ? (record.webhook as Record<string, unknown>)
      : record;

  const url =
    typeof webhook.url === "string"
      ? webhook.url
      : typeof webhook.webhook === "string"
        ? webhook.webhook
        : null;

  const enabled =
    typeof webhook.enabled === "boolean"
      ? webhook.enabled
      : typeof webhook.webhookEnabled === "boolean"
        ? webhook.webhookEnabled
        : null;

  const events = Array.isArray(webhook.events)
    ? webhook.events.filter((item): item is string => typeof item === "string")
    : null;

  return { url, enabled, events };
}

export async function getWhatsAppInboundDiagnostics() {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "") ?? null;
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? null;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? null;
  const expectedWebhookUrl = buildExpectedWebhookUrl();
  const heartbeat = await getInboundHeartbeat();

  const env = {
    evolutionApiUrlPresent: Boolean(baseUrl),
    evolutionApiKeyPresent: Boolean(apiKey),
    evolutionInstanceNamePresent: Boolean(instanceName),
    evolutionWebhookSecretConfigured: Boolean(
      process.env.EVOLUTION_WEBHOOK_SECRET?.trim()
    ),
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    vercelUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    resolvedAppUrl: getAppUrl(),
    expectedWebhookUrl,
  };

  let connectionState: EvolutionFetchResult | null = null;
  let webhookConfig: EvolutionFetchResult | null = null;
  let instanceFetch: EvolutionFetchResult | null = null;

  if (baseUrl && apiKey && instanceName) {
    connectionState = await evolutionFetch(
      baseUrl,
      apiKey,
      `/instance/connectionState/${encodeURIComponent(instanceName)}`
    );

    webhookConfig = await evolutionFetch(
      baseUrl,
      apiKey,
      `/webhook/find/${encodeURIComponent(instanceName)}`
    );

    instanceFetch = await evolutionFetch(baseUrl, apiKey, "/instance/fetchInstances");
  }

  const configuredWebhook = webhookConfig
    ? extractConfiguredWebhook(webhookConfig.json)
    : { url: null, enabled: null, events: null };

  const webhookUrlMatches =
    configuredWebhook.url != null
      ? configuredWebhook.url.replace(/\/$/, "") ===
        expectedWebhookUrl.replace(/\/$/, "")
      : null;

  return {
    debugLabel: "whatsapp-inbound-v1",
    timestamp: new Date().toISOString(),
    env,
    evolution: {
      connectionState: connectionState
        ? {
            ok: connectionState.ok,
            status: connectionState.status,
            endpoint: connectionState.endpoint,
            state: extractConnectionState(connectionState.json),
            raw: connectionState.json,
          }
        : null,
      webhook: webhookConfig
        ? {
            ok: webhookConfig.ok,
            status: webhookConfig.status,
            endpoint: webhookConfig.endpoint,
            configuredUrl: configuredWebhook.url,
            enabled: configuredWebhook.enabled,
            events: configuredWebhook.events,
            matchesExpectedUrl: webhookUrlMatches,
            raw: webhookConfig.json,
          }
        : null,
      instances: instanceFetch
        ? {
            ok: instanceFetch.ok,
            status: instanceFetch.status,
            endpoint: instanceFetch.endpoint,
            raw: instanceFetch.json,
          }
        : null,
    },
    heartbeat,
    interpretation: {
      webhookEndpointAliveCheck: `${expectedWebhookUrl.split("?")[0]} (GET should return alive JSON)`,
      ifNoWebhookHitInVercel:
        "Evolution is not POSTing to Vercel — fix webhook URL in Evolution/Railway to expectedWebhookUrl and ensure instance is connected (state=open).",
      ifHeartbeatStale:
        heartbeat?.last_webhook_received_at
          ? "A webhook was recorded previously but not recently."
          : "No webhook has ever been recorded in Supabase heartbeat.",
    },
  };
}
