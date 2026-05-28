import { NextResponse } from "next/server";
import {
  isEvolutionConfigured,
  sendWhatsAppTextSafe,
} from "@/lib/evolution/client";
import { getOutboundHealthSnapshot } from "@/lib/evolution/outbound-health";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ping = url.searchParams.get("ping") === "1";
  const testNumber = process.env.WHATSAPP_HEALTH_TEST_NUMBER?.trim() ?? null;

  const configured = isEvolutionConfigured();
  let connectivity:
    | { ok: true; status?: number; endpoint?: string }
    | { ok: false; reason: string; endpoint?: string; responseBody?: string } =
    configured
      ? { ok: false, reason: "Connectivity check not run." }
      : { ok: false, reason: "Evolution API env vars are not configured." };

  if (configured && ping && testNumber) {
    const result = await sendWhatsAppTextSafe(
      testNumber,
      "[Agentive01] WhatsApp health check ping."
    );

    connectivity = result.success
      ? { ok: true, status: result.status, endpoint: result.endpoint }
      : {
          ok: false,
          reason: result.error ?? "Ping failed.",
          endpoint: result.endpoint,
          responseBody: result.responseBody,
        };
  } else if (configured && ping && !testNumber) {
    connectivity = {
      ok: false,
      reason:
        "Set WHATSAPP_HEALTH_TEST_NUMBER to run a live send ping from this endpoint.",
    };
  }

  const health = getOutboundHealthSnapshot();

  return NextResponse.json({
    debugLabel: "whatsapp-health-v1",
    timestamp: new Date().toISOString(),
    evolution: {
      configured,
      baseUrl: process.env.EVOLUTION_API_URL ?? null,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME ?? null,
      hasApiKey: Boolean(process.env.EVOLUTION_API_KEY),
      connectivity,
    },
    outbound: {
      lastSuccess: health.lastSuccess,
      lastFailure: health.lastFailure,
      recentFailures: health.recentFailures,
    },
    notes: [
      "Add ?ping=1 to attempt a live text send when WHATSAPP_HEALTH_TEST_NUMBER is configured.",
      "Outbound failures no longer crash /api/webhooks/evolution; media falls back to text.",
    ],
  });
}
