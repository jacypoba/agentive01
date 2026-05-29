import { NextResponse } from "next/server";
import {
  isEvolutionConfigured,
  sendWhatsAppTextSafe,
} from "@/lib/evolution/client";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ping = url.searchParams.get("ping") === "1";
  const testNumber = process.env.WHATSAPP_HEALTH_TEST_NUMBER?.trim() ?? null;

  const configured = isEvolutionConfigured();
  const connection = configured ? await getEvolutionConnectionSnapshot() : null;

  let connectivity:
    | {
        ok: true;
        status?: number;
        endpoint?: string;
        destinationNumber?: string;
        evolutionMessageId?: string;
        responseBody?: string;
        pendingOnly?: boolean;
        sentToWhatsApp?: boolean;
        warning?: string | null;
        payloadFormat?: string;
      }
    | {
        ok: false;
        reason: string;
        endpoint?: string;
        responseBody?: string;
        destinationNumber?: string;
        pendingOnly?: boolean;
        warning?: string | null;
      } = configured
      ? { ok: false, reason: "Connectivity check not run." }
      : { ok: false, reason: "Evolution API env vars are not configured." };

  if (configured && ping && testNumber) {
    const remoteJid = `${testNumber.replace(/\D/g, "")}@s.whatsapp.net`;
    const result = await sendWhatsAppTextSafe(testNumber, "[Agentive01] WhatsApp health check ping.", {
      remoteJid,
    });

    connectivity = result.sentToWhatsApp
      ? {
          ok: true,
          status: result.status,
          endpoint: result.endpoint,
          destinationNumber: result.destinationNumber,
          evolutionMessageId: result.evolutionMessageId,
          responseBody: result.responseBody,
          pendingOnly: false,
          sentToWhatsApp: true,
          warning: null,
          payloadFormat: result.payloadFormat,
        }
      : {
          ok: false,
          reason:
            result.warning ??
            result.error ??
            (result.pendingOnly
              ? "Evolution accepted the ping but WhatsApp delivery is PENDING."
              : "Ping failed."),
          endpoint: result.endpoint,
          responseBody: result.responseBody,
          destinationNumber: result.destinationNumber,
          pendingOnly: result.pendingOnly ?? false,
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
  const lastFailureRuntime = outboundMemory.lastFailure;

  return NextResponse.json({
    debugLabel: "whatsapp-health-v3",
    timestamp: new Date().toISOString(),
    evolution: {
      configured,
      baseUrl: process.env.EVOLUTION_API_URL ?? null,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME ?? null,
      hasApiKey: Boolean(process.env.EVOLUTION_API_KEY),
      sendNumberFormat: process.env.EVOLUTION_SEND_NUMBER_FORMAT ?? "auto",
      connection,
      restartHint: getEvolutionRestartHint(),
      connectivity,
    },
    inbound: inboundHeartbeat,
    outbound: {
      persisted: outboundHeartbeat,
      runtime: outboundMemory,
    },
    summary: {
      lastInboundAt: inboundHeartbeat?.last_webhook_received_at ?? null,
      lastInboundPhone: inboundHeartbeat?.last_phone ?? null,
      lastInboundRemoteJid: inboundHeartbeat?.last_remote_jid ?? null,
      lastInboundStatus: inboundHeartbeat?.last_processing_status ?? null,
      lastOutboundAt: outboundHeartbeat?.last_webhook_received_at ?? null,
      lastOutboundDestination: outboundHeartbeat?.last_phone ?? null,
      lastOutboundEvolutionMessageId:
        outboundHeartbeat?.last_evolution_message_id ?? null,
      lastOutboundResponseBody: outboundHeartbeat?.last_response_body ?? null,
      lastOutboundDeliveryStatus: outboundHeartbeat?.last_delivery_status ?? null,
      lastOutboundProcessingStatus: outboundHeartbeat?.last_processing_status ?? null,
      lastFailure: lastFailureRuntime
        ? {
            at: lastFailureRuntime.at,
            kind: lastFailureRuntime.kind,
            destinationNumber:
              lastFailureRuntime.destinationNumber ??
              lastFailureRuntime.phoneDigits ??
              null,
            reason: lastFailureRuntime.reason ?? null,
            responseBody: lastFailureRuntime.responseBody ?? null,
            evolutionMessageId: lastFailureRuntime.evolutionMessageId ?? null,
            status: lastFailureRuntime.status ?? null,
          }
        : outboundHeartbeat?.last_error
          ? {
              at: outboundHeartbeat.last_webhook_received_at,
              kind: outboundHeartbeat.last_processing_status,
              destinationNumber: outboundHeartbeat.last_phone,
              reason: outboundHeartbeat.last_error,
              responseBody: outboundHeartbeat.last_response_body,
              evolutionMessageId: outboundHeartbeat.last_evolution_message_id,
              status: null,
            }
          : null,
    },
    pendingDiagnosis: getPendingDeliveryDiagnosis(),
    notes: [
      "Use /api/debug/evolution-send-test for payload-format diagnostics.",
      "HTTP 201 with status PENDING is NOT treated as a confirmed WhatsApp delivery.",
      "Production replies prefer inbound remoteJid in the Evolution number field.",
      "Add ?ping=1 here for a single live send when WHATSAPP_HEALTH_TEST_NUMBER is set.",
    ],
  });
}
