import { NextResponse } from "next/server";
import {
  isEvolutionConfigured,
  sendWhatsAppTextSafe,
} from "@/lib/evolution/client";
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
  let connectivity:
    | {
        ok: true;
        status?: number;
        endpoint?: string;
        destinationNumber?: string;
        evolutionMessageId?: string;
        responseBody?: string;
      }
    | {
        ok: false;
        reason: string;
        endpoint?: string;
        responseBody?: string;
        destinationNumber?: string;
      } = configured
      ? { ok: false, reason: "Connectivity check not run." }
      : { ok: false, reason: "Evolution API env vars are not configured." };

  if (configured && ping && testNumber) {
    const result = await sendWhatsAppTextSafe(
      testNumber,
      "[Agentive01] WhatsApp health check ping."
    );

    connectivity = result.success
      ? {
          ok: true,
          status: result.status,
          endpoint: result.endpoint,
          destinationNumber: result.destinationNumber,
          evolutionMessageId: result.evolutionMessageId,
          responseBody: result.responseBody,
        }
      : {
          ok: false,
          reason: result.error ?? "Ping failed.",
          endpoint: result.endpoint,
          responseBody: result.responseBody,
          destinationNumber: result.destinationNumber,
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
  const lastOutboundRuntime = outboundMemory.lastSuccess;
  const lastFailureRuntime = outboundMemory.lastFailure;

  return NextResponse.json({
    debugLabel: "whatsapp-health-v2",
    timestamp: new Date().toISOString(),
    evolution: {
      configured,
      baseUrl: process.env.EVOLUTION_API_URL ?? null,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME ?? null,
      hasApiKey: Boolean(process.env.EVOLUTION_API_KEY),
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
      lastOutboundAt:
        lastOutboundRuntime?.at ??
        outboundHeartbeat?.last_webhook_received_at ??
        null,
      lastOutboundDestination:
        lastOutboundRuntime?.destinationNumber ??
        outboundHeartbeat?.last_phone ??
        null,
      lastOutboundEvolutionMessageId:
        lastOutboundRuntime?.evolutionMessageId ??
        outboundHeartbeat?.last_evolution_message_id ??
        null,
      lastOutboundResponseBody:
        lastOutboundRuntime?.responseBody ??
        outboundHeartbeat?.last_response_body ??
        null,
      lastOutboundDeliveryStatus:
        lastOutboundRuntime?.deliveryStatus ??
        outboundHeartbeat?.last_delivery_status ??
        null,
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
    notes: [
      "Apply supabase/migrations/017_whatsapp_webhook_heartbeat_expand.sql if heartbeat reads fail.",
      "Add ?ping=1 to attempt a live text send when WHATSAPP_HEALTH_TEST_NUMBER is configured.",
      "Successful Evolution sends log full responseBody, evolutionMessageId, and destinationNumber.",
      "messages.update webhooks update last_delivery_status when Evolution emits delivery ACKs.",
    ],
  });
}
