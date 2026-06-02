import "server-only";

import { getAppUrl } from "@/lib/stripe/app-url";

export function buildExpectedWebhookUrl(): string {
  const base = getAppUrl();
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();

  if (secret) {
    return `${base}/api/webhooks/evolution?secret=${encodeURIComponent(secret)}`;
  }

  return `${base}/api/webhooks/evolution`;
}

export type SyncEvolutionWebhookResult =
  | { ok: true; webhookUrl: string; endpoint: string; status: number; response: unknown }
  | { ok: false; reason: string; endpoint?: string; status?: number; response?: unknown };

export async function syncEvolutionWebhookConfiguration(): Promise<SyncEvolutionWebhookResult> {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "") ?? null;
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? null;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? null;
  const webhookUrl = buildExpectedWebhookUrl();
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim() ?? null;

  if (!baseUrl || !apiKey || !instanceName) {
    return {
      ok: false,
      reason:
        "Evolution is not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME.",
    };
  }

  const outboundHeaders: Record<string, string> = {};
  if (webhookSecret) {
    outboundHeaders.Authorization = `Bearer ${webhookSecret}`;
  }
  if (apiKey) {
    outboundHeaders.apikey = apiKey;
  }

  const endpoint = `${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`;
  const body = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      headers: outboundHeaders,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "SEND_MESSAGE",
      ],
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await response.text();
    let parsed: unknown = raw;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw;
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: `Evolution webhook/set failed (${response.status}).`,
        endpoint,
        status: response.status,
        response: parsed,
      };
    }

    return {
      ok: true,
      webhookUrl,
      endpoint,
      status: response.status,
      response: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Failed to sync Evolution webhook.",
      endpoint,
    };
  }
}
