import { NextResponse } from "next/server";
import {
  buildSendTextPayloadVariants,
  isEvolutionConfigured,
  runEvolutionSendTextDiagnostic,
  type SendTextFormat,
} from "@/lib/evolution/client";
import {
  getEvolutionConnectionSnapshot,
  getEvolutionRestartHint,
  getPendingDeliveryDiagnosis,
} from "@/lib/evolution/evolution-instance";
import { parseEvolutionSendResponse } from "@/lib/evolution/parse-evolution-response";

const VALID_FORMATS = new Set<SendTextFormat | "all">([
  "digits",
  "jid",
  "textMessage",
  "jid_textMessage",
  "all",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const compareAll = url.searchParams.get("compareAll") === "1";
  const formatParam = url.searchParams.get("format")?.trim() as
    | SendTextFormat
    | "all"
    | undefined;
  const format =
    formatParam && VALID_FORMATS.has(formatParam) ? formatParam : undefined;

  const testNumber = process.env.WHATSAPP_HEALTH_TEST_NUMBER?.trim() ?? null;
  const remoteJidParam = url.searchParams.get("remoteJid")?.trim() ?? null;
  const remoteJid =
    remoteJidParam ??
    (testNumber ? `${testNumber.replace(/\D/g, "")}@s.whatsapp.net` : null);

  if (!testNumber) {
    return NextResponse.json(
      {
        debugLabel: "evolution-send-test-v1",
        error:
          "Set WHATSAPP_HEALTH_TEST_NUMBER in Vercel env to run a live Evolution send test.",
        env: {
          evolutionConfigured: isEvolutionConfigured(),
          whatsappHealthTestNumberConfigured: false,
        },
      },
      { status: 400 }
    );
  }

  if (format === "all" && !compareAll) {
    return NextResponse.json({
      debugLabel: "evolution-send-test-v1",
      error:
        "format=all sends multiple WhatsApp messages. Pass compareAll=1 to confirm.",
      variants: buildSendTextPayloadVariants({
        phoneDigits: testNumber,
        text: "[Agentive01] Evolution send format comparison test.",
        remoteJid,
      }),
    });
  }

  const text =
    url.searchParams.get("text")?.trim() ??
    "[Agentive01] Evolution sendText diagnostic ping.";

  const diagnostic = await runEvolutionSendTextDiagnostic({
    phoneDigits: testNumber,
    text,
    format: format === "all" ? "all" : format,
    remoteJid,
    dryRun,
  });

  const connection =
    diagnostic.connection ??
    (isEvolutionConfigured() ? await getEvolutionConnectionSnapshot() : null);

  const sendResult = diagnostic.sendResult;
  const parsed = sendResult?.responseBody
    ? parseEvolutionSendResponse(sendResult.responseBody)
    : null;

  return NextResponse.json({
    debugLabel: "evolution-send-test-v1",
    timestamp: new Date().toISOString(),
    env: {
      evolutionConfigured: diagnostic.configured,
      whatsappHealthTestNumber: testNumber,
      evolutionSendNumberFormat: process.env.EVOLUTION_SEND_NUMBER_FORMAT ?? "auto",
      remoteJidUsed: remoteJid,
    },
    connection,
    restartHint: getEvolutionRestartHint(),
    pendingDiagnosis: getPendingDeliveryDiagnosis(),
    dryRun,
    selectedFormat: diagnostic.selectedFormat,
    payloadVariants: diagnostic.variants,
    send: sendResult
      ? {
          endpoint: sendResult.endpoint ?? null,
          payload: sendResult.payload ?? null,
          payloadFormat: sendResult.payloadFormat ?? diagnostic.selectedFormat,
          status: sendResult.status ?? null,
          responseBody: sendResult.responseBody ?? null,
          parsedMessageId: parsed?.messageId ?? sendResult.evolutionMessageId ?? null,
          deliveryKey: parsed?.deliveryKey ?? sendResult.deliveryKey ?? null,
          deliveryStatus: parsed?.deliveryStatus ?? sendResult.deliveryStatus ?? null,
          accepted: sendResult.accepted ?? null,
          pendingOnly: sendResult.pendingOnly ?? null,
          deliveryConfirmed: sendResult.deliveryConfirmed ?? null,
          sentToWhatsApp: sendResult.sentToWhatsApp ?? null,
          warning: sendResult.warning ?? null,
          instanceState: sendResult.instanceState ?? connection?.state ?? null,
          error: sendResult.error ?? null,
        }
      : null,
    compareResults: diagnostic.compareResults?.map((result) => ({
      payloadFormat: result.payloadFormat ?? null,
      payload: result.payload ?? null,
      status: result.status ?? null,
      deliveryStatus: result.deliveryStatus ?? null,
      pendingOnly: result.pendingOnly ?? null,
      sentToWhatsApp: result.sentToWhatsApp ?? null,
      warning: result.warning ?? null,
      evolutionMessageId: result.evolutionMessageId ?? null,
    })),
    notes: [
      "Default production send uses jid format when inbound remoteJid is known.",
      "HTTP 201 + PENDING is NOT a confirmed WhatsApp delivery.",
      "After reconnect, restart Evolution instance if outbound stays PENDING.",
      "Use ?dryRun=1 to inspect payloads without sending.",
      "Use ?format=jid|digits|textMessage|jid_textMessage to test one payload shape.",
    ],
  });
}
