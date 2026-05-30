import { NextResponse } from "next/server";
import {
  buildSendTextPayloadVariants,
  getProductionSendTextFormatOrder,
  isEvolutionConfigured,
  sendWhatsAppTextSafe as sendEvolutionWhatsAppTextSafe,
  type SendTextFormat,
} from "@/lib/evolution/client";
import { getWhatsAppProviderSummary } from "@/lib/whatsapp/send";
import {
  getEvolutionConnectionSnapshot,
  getEvolutionRestartHint,
  getPendingDeliveryDiagnosis,
} from "@/lib/evolution/evolution-instance";
import { normalizePhoneDigits } from "@/lib/phone/normalize";
import {
  redactConnectionSnapshot,
  redactEvolutionEnvBlock,
  redactSendResult,
} from "@/lib/security/redact-debug-response";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";

const ROUTE = "/api/debug/evolution-send";

const VALID_FORMATS = new Set<SendTextFormat>([
  "digits",
  "jid",
  "textMessage",
  "jid_textMessage",
]);

function resolveTargetPhone(request: Request): string | null {
  const url = new URL(request.url);
  const phoneParam = url.searchParams.get("phone")?.trim();
  if (phoneParam) {
    return normalizePhoneDigits(phoneParam);
  }

  const envPhone = process.env.WHATSAPP_HEALTH_TEST_NUMBER?.trim();
  return envPhone ? normalizePhoneDigits(envPhone) : null;
}

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const fallback = url.searchParams.get("fallback") !== "0";
  const formatParam = url.searchParams.get("format")?.trim() as SendTextFormat | undefined;
  const format =
    formatParam && VALID_FORMATS.has(formatParam) ? formatParam : undefined;

  const phoneDigits = resolveTargetPhone(request);
  const remoteJidParam = url.searchParams.get("remoteJid")?.trim() ?? null;
  const remoteJid =
    remoteJidParam ??
    (phoneDigits ? `${phoneDigits}@s.whatsapp.net` : null);

  const text =
    url.searchParams.get("text")?.trim() ??
    "[Agentive01] Evolution manual send diagnostic.";

  if (!phoneDigits) {
    return NextResponse.json(
      {
        debugLabel: "evolution-send-v1",
        error:
          "Provide ?phone=393479896685 or set WHATSAPP_HEALTH_TEST_NUMBER in env.",
        example:
          "/api/debug/evolution-send?phone=393479896685&text=hello&fallback=1",
      },
      { status: 400 }
    );
  }

  const configured = isEvolutionConfigured();
  const connection = configured ? await getEvolutionConnectionSnapshot() : null;
  const variants = buildSendTextPayloadVariants({
    phoneDigits,
    text,
    remoteJid,
  });
  const formatOrder = getProductionSendTextFormatOrder(remoteJid);

  if (dryRun || !configured) {
    return NextResponse.json({
      debugLabel: "evolution-send-v1",
      timestamp: new Date().toISOString(),
      dryRun: true,
      configured,
      target: {
        phone: phoneDigits,
        normalizedPhone: phoneDigits,
        remoteJid,
      },
      evolution: redactEvolutionEnvBlock({
        baseUrl: process.env.EVOLUTION_API_URL ?? null,
        instanceName: process.env.EVOLUTION_INSTANCE_NAME ?? null,
        hasApiKey: Boolean(process.env.EVOLUTION_API_KEY),
        endpoint: configured
          ? `${process.env.EVOLUTION_API_URL?.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(process.env.EVOLUTION_INSTANCE_NAME ?? "")}`
          : null,
      }),
      connection: redactConnectionSnapshot(connection),
      formatOrder,
      payloadVariants: variants,
      restartHint: getEvolutionRestartHint(),
      pendingDiagnosis: getPendingDeliveryDiagnosis(),
    });
  }

  const result = await sendEvolutionWhatsAppTextSafe(phoneDigits, text, {
    remoteJid,
    format,
    disableFallback: !fallback || Boolean(format),
  });

  return NextResponse.json({
    debugLabel: "evolution-send-v1",
    timestamp: new Date().toISOString(),
    provider: getWhatsAppProviderSummary(),
    target: {
      phone: phoneDigits,
      normalizedPhone: phoneDigits,
      remoteJid,
    },
    evolution: redactEvolutionEnvBlock({
      baseUrl: process.env.EVOLUTION_API_URL ?? null,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME ?? null,
      hasApiKey: Boolean(process.env.EVOLUTION_API_KEY),
    }),
    connection: redactConnectionSnapshot(connection),
    send: redactSendResult({
      endpoint: result.endpoint ?? null,
      payload: result.payload ?? null,
      payloadFormat: result.payloadFormat ?? null,
      status: result.status ?? null,
      responseBody: result.responseBody ?? null,
      evolutionMessageId: result.evolutionMessageId ?? null,
      deliveryKey: result.deliveryKey ?? null,
      deliveryStatus: result.deliveryStatus ?? null,
      accepted: result.accepted ?? null,
      pendingOnly: result.pendingOnly ?? null,
      sentToWhatsApp: result.sentToWhatsApp ?? null,
      deliveryConfirmed: result.deliveryConfirmed ?? null,
      warning: result.warning ?? null,
      fallbackUsed: result.fallbackUsed ?? false,
      attempts: result.attempts ?? [],
      deliveryVerification: result.deliveryVerification ?? null,
      error: result.error ?? null,
    }),
    formatOrder,
    payloadVariants: variants,
    restartHint: getEvolutionRestartHint(),
    pendingDiagnosis: getPendingDeliveryDiagnosis(),
    notes: [
      "Use ?phone= to target any number. WHATSAPP_HEALTH_TEST_NUMBER is the fallback.",
      "Use ?fallback=0 or ?format= to send only one payload shape.",
      "Use ?dryRun=1 to inspect payloads without sending.",
      "Production webhook replies use fallback order: digits → jid → textMessage → jid_textMessage when PENDING persists.",
    ],
  });
}

export async function POST(request: Request) {
  return GET(request);
}
