import type { EvolutionWebhookPayload } from "@/lib/evolution/types";
import { evolutionGet } from "@/lib/evolution/evolution-instance";

export type EvolutionWebhookPayloadExtended = EvolutionWebhookPayload & {
  server_url?: string;
  destination?: string;
  date_time?: string;
  sender?: string;
};

type InstanceTokenCache = {
  instance: string;
  token: string;
  fetchedAt: number;
};

const INSTANCE_TOKEN_CACHE_MS = 5 * 60 * 1000;
let instanceTokenCache: InstanceTokenCache | null = null;

function trimSecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function collectConfiguredSecrets(): string[] {
  const values = [
    trimSecret(process.env.EVOLUTION_API_KEY),
    trimSecret(process.env.EVOLUTION_INSTANCE_TOKEN),
    trimSecret(process.env.EVOLUTION_WEBHOOK_SECRET),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(values)];
}

function matchesConfiguredSecret(
  received: string | null | undefined,
  configured: string[]
): boolean {
  const candidate = trimSecret(received);
  if (!candidate) {
    return false;
  }

  return configured.some((allowed) => allowed === candidate);
}

function readHeaderSecrets(request: Request): string[] {
  const values: string[] = [];
  const headerNames = ["apikey", "x-api-key", "x-apikey"];

  for (const name of headerNames) {
    const value = request.headers.get(name);
    if (value) {
      values.push(value);
    }
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    values.push(authorization.slice("Bearer ".length));
  }

  return values;
}

function readInstanceRows(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  }

  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    if (Array.isArray(record.instances)) {
      return record.instances.filter(
        (row): row is Record<string, unknown> => Boolean(row && typeof row === "object")
      );
    }
    if (Array.isArray(record.data)) {
      return record.data.filter(
        (row): row is Record<string, unknown> => Boolean(row && typeof row === "object")
      );
    }
  }

  return [];
}

function readInstanceTokenFromRow(row: Record<string, unknown>): string | null {
  const direct =
    trimSecret(typeof row.token === "string" ? row.token : null) ??
    trimSecret(typeof row.hash === "string" ? row.hash : null) ??
    trimSecret(typeof row.apikey === "string" ? row.apikey : null);

  if (direct) {
    return direct;
  }

  if (row.instance && typeof row.instance === "object") {
    const nested = row.instance as Record<string, unknown>;
    return (
      trimSecret(typeof nested.token === "string" ? nested.token : null) ??
      trimSecret(typeof nested.hash === "string" ? nested.hash : null) ??
      trimSecret(typeof nested.apikey === "string" ? nested.apikey : null)
    );
  }

  return null;
}

async function resolveInstanceToken(instanceName: string): Promise<string | null> {
  const cached = instanceTokenCache;
  if (
    cached &&
    cached.instance === instanceName &&
    Date.now() - cached.fetchedAt < INSTANCE_TOKEN_CACHE_MS
  ) {
    return cached.token;
  }

  const configured = trimSecret(process.env.EVOLUTION_INSTANCE_TOKEN);
  if (configured) {
    return configured;
  }

  const fetchResult = await evolutionGet("/instance/fetchInstances");
  if (!fetchResult?.ok) {
    return null;
  }

  const rows = readInstanceRows(fetchResult.json);
  const match = rows.find((row) => {
    const name =
      trimSecret(typeof row.name === "string" ? row.name : null) ??
      trimSecret(typeof row.instanceName === "string" ? row.instanceName : null) ??
      (row.instance && typeof row.instance === "object"
        ? trimSecret(
            typeof (row.instance as Record<string, unknown>).instanceName === "string"
              ? ((row.instance as Record<string, unknown>).instanceName as string)
              : null
          )
        : null);

    return name === instanceName;
  });

  const token = match ? readInstanceTokenFromRow(match) : null;
  if (token) {
    instanceTokenCache = {
      instance: instanceName,
      token,
      fetchedAt: Date.now(),
    };
  }

  return token;
}

export function verifyEvolutionWebhook(
  request: Request,
  payload: EvolutionWebhookPayloadExtended
): boolean {
  const configured = collectConfiguredSecrets();

  if (matchesConfiguredSecret(new URL(request.url).searchParams.get("secret"), configured)) {
    return true;
  }

  for (const headerSecret of readHeaderSecrets(request)) {
    if (matchesConfiguredSecret(headerSecret, configured)) {
      return true;
    }
  }

  if (matchesConfiguredSecret(payload.apikey, configured)) {
    return true;
  }

  if (!trimSecret(process.env.EVOLUTION_API_KEY)) {
    return process.env.NODE_ENV !== "production";
  }

  return false;
}

export async function verifyEvolutionWebhookAsync(
  request: Request,
  payload: EvolutionWebhookPayloadExtended
): Promise<boolean> {
  if (verifyEvolutionWebhook(request, payload)) {
    return true;
  }

  const instance =
    trimSecret(payload.instance) ?? trimSecret(process.env.EVOLUTION_INSTANCE_NAME);
  const payloadApiKey = trimSecret(payload.apikey);

  if (instance && payloadApiKey) {
    const instanceToken = await resolveInstanceToken(instance);
    if (instanceToken && payloadApiKey === instanceToken) {
      return true;
    }
  }

  return false;
}

export function buildEvolutionWebhookAuthSummary() {
  return {
    acceptsQuerySecret: Boolean(trimSecret(process.env.EVOLUTION_WEBHOOK_SECRET)),
    acceptsHeaderApiKey: Boolean(trimSecret(process.env.EVOLUTION_API_KEY)),
    acceptsPayloadApiKey: true,
    acceptsInstanceToken: Boolean(
      trimSecret(process.env.EVOLUTION_INSTANCE_TOKEN) ||
        trimSecret(process.env.EVOLUTION_API_KEY)
    ),
    acceptsTrustedOriginWithPayloadApiKey: Boolean(
      trimSecret(process.env.EVOLUTION_API_URL) &&
        trimSecret(process.env.EVOLUTION_INSTANCE_NAME)
    ),
    requiredWebhookUrlWhenSecretConfigured:
      trimSecret(process.env.EVOLUTION_WEBHOOK_SECRET) != null
        ? "https://<app>/api/webhooks/evolution?secret=<EVOLUTION_WEBHOOK_SECRET>"
        : null,
    evolutionOutboundHeaders: [
      "apikey (global or instance token)",
      "Authorization: Bearer <EVOLUTION_WEBHOOK_SECRET or token>",
      "x-api-key",
      "JSON body field apikey (instance token)",
    ],
  };
}
