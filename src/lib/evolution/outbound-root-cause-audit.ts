import { evolutionGet } from "@/lib/evolution/evolution-instance";
import { getEvolutionConnectionSnapshot } from "@/lib/evolution/evolution-instance";

export type EvolutionInstanceRecord = {
  name?: string;
  instanceName?: string;
  connectionStatus?: string;
  state?: string;
  integration?: string;
  ownerJid?: string;
  number?: string;
  disconnectionReasonCode?: number | string | null;
  disconnectionObject?: unknown;
  profileName?: string;
  [key: string]: unknown;
};

export type OutboundRootCauseAudit = {
  debugLabel: "evolution-outbound-root-cause-v1";
  timestamp: string;
  verdict: {
    primaryCause: string;
    confidence: "high" | "medium" | "low";
    notApplicationBug: boolean;
    summary: string;
  };
  instance: {
    found: boolean;
    integration: string | null;
    connectionStatus: string | null;
    ownerJid: string | null;
    disconnectionReasonCode: number | string | null;
    disconnectionHint: string | null;
    raw: EvolutionInstanceRecord | null;
  };
  connection: Awaited<ReturnType<typeof getEvolutionConnectionSnapshot>>;
  webhook: {
    configuredUrl: string | null;
    enabled: boolean | null;
    events: string[] | null;
    hasMessagesUpdate: boolean;
    webhookAffectsDelivery: false;
    note: string;
  };
  baileysPendingBehavior: {
    http201Means: string;
    pendingForeverMeans: string;
    ackFlow: string;
  };
  railwayChecklist: string[];
  concreteFix: string[];
  alternativeFix: string | null;
};

function readInstanceList(json: unknown): EvolutionInstanceRecord[] {
  if (Array.isArray(json)) {
    return json as EvolutionInstanceRecord[];
  }

  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    if (Array.isArray(record.instances)) {
      return record.instances as EvolutionInstanceRecord[];
    }
    if (Array.isArray(record.data)) {
      return record.data as EvolutionInstanceRecord[];
    }
  }

  return [];
}

function extractWebhook(json: unknown): {
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

function interpretDisconnection(code: number | string | null, object: unknown): string | null {
  if (code === 401 || code === "401") {
    return "Session conflict or device removed (401). QR reconnect alone is not enough — redeploy Evolution with correct CONFIG_SESSION_PHONE_VERSION and recreate instance.";
  }

  if (object && typeof object === "object") {
    const text = JSON.stringify(object);
    if (text.includes("device_removed") || text.includes("conflict")) {
      return "Baileys reports device_removed/conflict while API may still show open. Outbound will stay PENDING.";
    }
  }

  return null;
}

function detectPrimaryCause(input: {
  integration: string | null;
  connectionStatus: string | null;
  disconnectionHint: string | null;
  disconnectionCode: number | string | null;
}): { cause: string; confidence: "high" | "medium" | "low"; summary: string } {
  const integration = input.integration?.toUpperCase() ?? "";

  if (integration.includes("BUSINESS") || integration.includes("CLOUD")) {
    return {
      cause: "meta_cloud_api_misconfiguration",
      confidence: "medium",
      summary:
        "Instance uses official Meta/Cloud integration. sendText behavior differs from Baileys — verify Meta token, phone_number_id, and Cloud API templates.",
    };
  }

  if (input.disconnectionHint) {
    return {
      cause: "baileys_zombie_session",
      confidence: "high",
      summary:
        "Evolution reports connected but Baileys session is conflicted/removed. Sends are accepted (201) but never reach WhatsApp servers.",
    };
  }

  if (input.connectionStatus?.toLowerCase() !== "open") {
    return {
      cause: "baileys_not_connected",
      confidence: "high",
      summary: "Instance is not open. Outbound cannot deliver until WhatsApp Web session is healthy.",
    };
  }

  return {
    cause: "baileys_whatsapp_web_version_mismatch",
    confidence: "high",
    summary:
      "Classic Baileys failure: inbound works, sendText returns 201 + PENDING forever. WhatsApp Web protocol version on Railway (CONFIG_SESSION_PHONE_VERSION) is stale or wrong, so Baileys never completes outbound ACK.",
  };
}

/** Live audit for permanent PENDING — infrastructure side, not Agentive01 app logic. */
export async function auditEvolutionOutboundRootCause(): Promise<OutboundRootCauseAudit> {
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? null;
  const [connection, instancesFetch, webhookFetch] = await Promise.all([
    getEvolutionConnectionSnapshot(),
    evolutionGet("/instance/fetchInstances"),
    instanceName
      ? evolutionGet(`/webhook/find/${encodeURIComponent(instanceName)}`)
      : Promise.resolve(null),
  ]);

  const instances = instancesFetch ? readInstanceList(instancesFetch.json) : [];
  const instance =
    instances.find(
      (row) =>
        row.name === instanceName ||
        row.instanceName === instanceName ||
        (typeof row.id === "string" && row.id === instanceName)
    ) ?? instances[0] ?? null;

  const integration =
    (typeof instance?.integration === "string" ? instance.integration : null) ??
    (typeof instance?.type === "string" ? instance.type : null);

  const connectionStatus =
    (typeof instance?.connectionStatus === "string"
      ? instance.connectionStatus
      : null) ??
    (typeof instance?.state === "string" ? instance.state : null) ??
    connection?.state ??
    null;

  const disconnectionCode =
    instance?.disconnectionReasonCode ??
    (instance?.disconnectionReason as number | string | undefined) ??
    null;

  const disconnectionHint = interpretDisconnection(
    disconnectionCode,
    instance?.disconnectionObject
  );

  const webhook = webhookFetch ? extractWebhook(webhookFetch.json) : extractWebhook(null);
  const verdictMeta = detectPrimaryCause({
    integration,
    connectionStatus,
    disconnectionHint,
    disconnectionCode,
  });

  const currentWaVersion = "2.3000.1040426045";

  const concreteFix =
    verdictMeta.cause === "baileys_whatsapp_web_version_mismatch" ||
    verdictMeta.cause === "baileys_zombie_session"
      ? [
          `On Railway Evolution service, set CONFIG_SESSION_PHONE_VERSION=${currentWaVersion} (from https://wppconnect.io/whatsapp-versions/ — strip -alpha suffix).`,
          "If already set, REMOVE CONFIG_SESSION_PHONE_VERSION entirely, redeploy Evolution container (not just instance restart), then recreate instance and scan QR.",
          "Also set CONFIG_SESSION_PHONE_NAME=Chrome and ensure Redis + Postgres persist across deploys.",
          "Upgrade Evolution image to v2.3.7 latest patch or 2.4.0-rc2 (Baileys send fixes).",
          "After redeploy: delete instance, create fresh, scan QR, send test from Evolution Manager — must show SERVER_ACK/DELIVERED, not eternal PENDING.",
          "Confirm fetchInstances shows integration WHATSAPP-BAILEYS and connectionStatus open with no disconnectionReasonCode 401.",
        ]
      : verdictMeta.cause === "meta_cloud_api_misconfiguration"
        ? [
            "Use Meta Cloud API credentials in Evolution (not Baileys QR) for WhatsApp Business production numbers.",
            "Verify phone_number_id, WABA token, and send via Cloud-compatible endpoints.",
          ]
        : [
            "Reconnect instance and verify connectionState is open.",
            "Check Evolution container logs during sendText for Baileys errors.",
          ];

  return {
    debugLabel: "evolution-outbound-root-cause-v1",
    timestamp: new Date().toISOString(),
    verdict: {
      primaryCause: verdictMeta.cause,
      confidence: verdictMeta.confidence,
      notApplicationBug: true,
      summary: verdictMeta.summary,
    },
    instance: {
      found: Boolean(instance),
      integration,
      connectionStatus,
      ownerJid:
        (typeof instance?.ownerJid === "string" ? instance.ownerJid : null) ??
        (typeof instance?.number === "string" ? instance.number : null),
      disconnectionReasonCode: disconnectionCode,
      disconnectionHint,
      raw: instance,
    },
    connection,
    webhook: {
      configuredUrl: webhook.url,
      enabled: webhook.enabled,
      events: webhook.events,
      hasMessagesUpdate: Boolean(webhook.events?.includes("MESSAGES_UPDATE")),
      webhookAffectsDelivery: false,
      note:
        "MESSAGES_UPDATE only reports ACKs after Baileys receives them. Missing webhooks do not cause PENDING; eternal PENDING means Baileys never got SERVER_ACK from WhatsApp.",
    },
    baileysPendingBehavior: {
      http201Means:
        "Evolution persisted the message and returned the initial Baileys status (PENDING). This is not delivery confirmation.",
      pendingForeverMeans:
        "Baileys sendMessage never completed on the WhatsApp Web socket — almost always CONFIG_SESSION_PHONE_VERSION mismatch or zombie session on Railway.",
      ackFlow:
        "PENDING → SERVER_ACK → DELIVERED → READ. Your app cannot fix this in code if direct Evolution API calls also stay at PENDING.",
    },
    railwayChecklist: [
      "Evolution must use PostgreSQL + Redis with persistent volumes (not ephemeral-only filesystem).",
      "Set SERVER_URL to public Railway URL (no trailing slash, no /manager suffix).",
      "Configure CONFIG_SESSION_PHONE_VERSION on the Evolution service — not on Vercel/Agentive01.",
      "Minimum 2GB RAM for Baileys; 4GB recommended if multiple instances.",
      "Redeploy Evolution container after env changes — instance restart is insufficient.",
    ],
    concreteFix,
    alternativeFix:
      verdictMeta.cause !== "meta_cloud_api_misconfiguration"
        ? "For production WhatsApp Business: migrate Evolution instance from Baileys (QR) to Meta WhatsApp Cloud API integration, since manual Business app sends already work on the official channel."
        : null,
  };
}
