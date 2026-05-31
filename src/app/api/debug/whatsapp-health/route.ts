import { NextResponse } from "next/server";
import {
  getEvolutionConnectionSnapshot,
  getEvolutionRestartHint,
  getPendingDeliveryDiagnosis,
} from "@/lib/evolution/evolution-instance";
import {
  getInboundHeartbeat,
  getOutboundHeartbeat,
} from "@/lib/evolution/whatsapp-heartbeat";
import { getOutboundHealthSnapshot } from "@/lib/evolution/outbound-health";
import {
  redactConnectionSnapshot,
  redactConnectivityBlock,
  redactEvolutionEnvBlock,
  redactMetaProviderBlock,
} from "@/lib/security/redact-debug-response";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";
import {
  getWhatsAppProviderSummary,
  isWhatsAppConfigured,
  sendWhatsAppTextSafe,
} from "@/lib/whatsapp/send";
import { getAppUrl } from "@/lib/stripe/app-url";

const ROUTE = "/api/debug/whatsapp-health";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const ping = url.searchParams.get("ping") === "1";
  const testNumber = process.env.WHATSAPP_HEALTH_TEST_NUMBER?.trim() ?? null;

  const provider = getWhatsAppProviderSummary();
  const configured = isWhatsAppConfigured();
  const connection =
    provider.evolutionConfigured ? await getEvolutionConnectionSnapshot() : null;

  let connectivity:
    | {
        ok: true;
        provider?: string;
        status?: number;
        endpoint?: string;
        destinationNumber?: string;
        providerMessageId?: string;
        responseBody?: string;
        sentToWhatsApp?: boolean;
        fallbackUsed?: boolean;
        warning?: string | null;
      }
    | {
        ok: false;
        reason: string;
        provider?: string;
        endpoint?: string;
        responseBody?: string;
        destinationNumber?: string;
        warning?: string | null;
      } = configured
      ? { ok: false, reason: "Connectivity check not run." }
      : { ok: false, reason: "No WhatsApp provider configured." };

  if (configured && ping && testNumber) {
    const result = await sendWhatsAppTextSafe(testNumber, "[Agentive01] WhatsApp health check ping.", {
      metaOnly: url.searchParams.get("metaOnly") === "1",
    });

    connectivity = result.sentToWhatsApp
      ? {
          ok: true,
          provider: result.provider,
          status: result.status,
          endpoint: result.endpoint,
          destinationNumber: result.destinationNumber,
          providerMessageId: result.providerMessageId,
          responseBody: result.responseBody,
          sentToWhatsApp: true,
          fallbackUsed: result.fallbackUsed,
          warning: result.warning,
        }
      : {
          ok: false,
          provider: result.provider,
          reason:
            result.warning ??
            result.error ??
            "Ping failed on configured provider(s).",
          endpoint: result.endpoint,
          responseBody: result.responseBody,
          destinationNumber: result.destinationNumber,
          warning: result.warning ?? null,
        };
  } else if (configured && ping && !testNumber) {
    connectivity = {
      ok: false,
      reason:
        "Set WHATSAPP_HEALTH_TEST_NUMBER to run a live send ping from this endpoint.",
    };
  }

  const [inboundHeartbeat, outboundHeartbeat] = await Promise.all([
    getInboundHeartbeat(),
    getOutboundHeartbeat(),
  ]);
  const outboundMemory = getOutboundHealthSnapshot();

  return NextResponse.json({
    debugLabel: "whatsapp-health-v5",
    timestamp: new Date().toISOString(),
    provider,
    webhooks: {
      meta: `${getAppUrl()}/api/webhooks/meta`,
      evolution: `${getAppUrl()}/api/webhooks/evolution`,
    },
    evolution: {
      configured: provider.evolutionConfigured,
      fallbackEnabled: provider.evolutionFallbackEnabled,
      connection: redactConnectionSnapshot(connection),
      restartHint: provider.evolutionConfigured ? getEvolutionRestartHint() : null,
      connectivity:
        provider.primary === "evolution"
          ? redactConnectivityBlock(connectivity)
          : null,
    },
    meta: {
      ...redactMetaProviderBlock({
        configured: provider.metaConfigured,
        phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? null,
        graphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v21.0",
      }),
      connectivity:
        provider.primary === "meta"
          ? redactConnectivityBlock(connectivity)
          : null,
    },
    inbound: inboundHeartbeat,
    outbound: {
      persisted: outboundHeartbeat,
      runtime: outboundMemory,
    },
    summary: {
      lastInboundAt: inboundHeartbeat?.last_webhook_received_at ?? null,
      lastInboundPhone: inboundHeartbeat?.last_phone ?? null,
      lastOutboundDestination: outboundHeartbeat?.last_phone ?? null,
      lastOutboundProviderMessageId:
        outboundHeartbeat?.last_evolution_message_id ?? null,
      lastOutboundDeliveryStatus: outboundHeartbeat?.last_delivery_status ?? null,
      lastOutboundResponseBody: outboundHeartbeat?.last_response_body
        ? "[redacted]"
        : null,
    },
    pendingDiagnosis:
      provider.primary === "evolution" ? getPendingDeliveryDiagnosis() : null,
    notes: [
      "Protected: CRON_SECRET (Bearer or x-cron-secret) or workspace owner/admin.",
      "Production default: WHATSAPP_PROVIDER=meta with Meta Cloud API credentials.",
      "Add ?ping=1 with WHATSAPP_HEALTH_TEST_NUMBER for live send test.",
      "Add ?metaOnly=1 to ping Meta without Evolution fallback.",
      "Meta accepted (wamid) is not delivery — use /api/debug/meta-message-status for diagnosis.",
    ],
  });
}
