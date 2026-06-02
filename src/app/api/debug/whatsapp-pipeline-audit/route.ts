import { NextResponse } from "next/server";
import { buildWhatsAppPipelineAudit } from "@/lib/whatsapp/pipeline-audit";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";
import { getAppUrl } from "@/lib/stripe/app-url";

const ROUTE = "/api/debug/whatsapp-pipeline-audit";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  try {
    const audit = await buildWhatsAppPipelineAudit();

    return NextResponse.json({
      ...audit,
      numberedChecklist: {
        "1_evolutionInboundReachingInstance": audit.checklist.evolutionInboundReachingInstance,
        "2_evolutionForwardingWebhookToAgentive01":
          audit.checklist.evolutionForwardingWebhookToAgentive01,
        "3_agentive01ReceivingWebhook": audit.checklist.agentive01ReceivingWebhook,
        "4_inboundStoredInSupabase": audit.checklist.inboundStoredInSupabase,
        "5_aiPipelineTriggered": audit.checklist.aiPipelineTriggered,
        "6_openAiReplyGenerated": audit.checklist.openAiReplyGenerated,
        "7_outboundSendAttempted": audit.checklist.outboundSendAttempted,
        "8_outboundProvider": audit.checklist.outboundProvider,
        "9_userReceivesReply": audit.checklist.userReceivesReply,
      },
      endpoints: {
        thisAudit: `${getAppUrl()}${ROUTE}`,
        whatsappInbound: `${getAppUrl()}/api/debug/whatsapp-inbound`,
        whatsappHealth: `${getAppUrl()}/api/debug/whatsapp-health`,
        evolutionOutboundAudit: `${getAppUrl()}/api/debug/evolution-outbound-audit`,
        metaMessageStatus: `${getAppUrl()}/api/debug/meta-message-status`,
        evolutionWebhook: `${getAppUrl()}/api/webhooks/evolution`,
        metaWebhook: `${getAppUrl()}/api/webhooks/meta`,
      },
      notes: [
        "Protected: CRON_SECRET (Bearer or x-cron-secret) or workspace owner/admin.",
        "Diagnosis only — send a test message, then re-run within 15 minutes for fresh heartbeats.",
        "Checklist answers use persisted heartbeats + Supabase; runtime outbound is per server instance.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        debugLabel: "whatsapp-pipeline-audit-v1",
        error:
          error instanceof Error
            ? error.message
            : "Failed to build WhatsApp pipeline audit.",
      },
      { status: 500 }
    );
  }
}
