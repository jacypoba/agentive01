import { getOutboundHealthSnapshot } from "@/lib/evolution/outbound-health";
import { getWhatsAppInboundDiagnostics } from "@/lib/evolution/inbound-diagnostics";
import {
  getInboundHeartbeat,
  getOutboundHeartbeat,
} from "@/lib/evolution/whatsapp-heartbeat";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getWhatsAppProviderMode,
  isEvolutionWhatsAppConfigured,
  isEvolutionFallbackEnabled,
  isMetaWhatsAppConfigured,
  resolvePrimaryWhatsAppProvider,
} from "@/lib/whatsapp/config";
import {
  buildPipelineChecklist,
  inferPipelineBreakingPoint,
  type PipelineBreakingPoint,
  type PipelineChecklist,
} from "@/lib/whatsapp/pipeline-audit-logic";
import type { WhatsAppWebhookHeartbeat } from "@/types/database";

export type {
  PipelineBreakingPoint,
  PipelineChecklist,
  PipelineCheckAnswer,
} from "@/lib/whatsapp/pipeline-audit-logic";
export { buildPipelineChecklist, inferPipelineBreakingPoint } from "@/lib/whatsapp/pipeline-audit-logic";

export type WhatsAppPipelineAudit = {
  debugLabel: "whatsapp-pipeline-audit-v1";
  timestamp: string;
  provider: {
    mode: string;
    primaryOutbound: "meta" | "evolution" | null;
    metaConfigured: boolean;
    evolutionConfigured: boolean;
    evolutionFallbackEnabled: boolean;
    inboundChannelNote: string;
  };
  evolution: {
    instanceName: string | null;
    connectionState: string | null;
    webhookUrlMatches: boolean | null;
    webhookEnabled: boolean | null;
    expectedWebhookUrl: string;
  };
  meta: {
    configured: boolean;
    phoneNumberId: string | null;
  };
  heartbeats: {
    inbound: WhatsAppWebhookHeartbeat | null;
    outbound: WhatsAppWebhookHeartbeat | null;
  };
  runtimeOutbound: ReturnType<typeof getOutboundHealthSnapshot>;
  supabase: {
    lastProcessedMessages: Array<{
      messageId: string;
      instance: string;
      remoteJid: string | null;
      createdAt: string;
    }>;
    workspaceConnections: Array<{
      provider: string;
      providerInstanceId: string;
      workspaceId: string;
      isActive: boolean;
    }>;
    recentConversations: Array<{
      id: string;
      leadId: string;
      sender: string;
      createdAt: string;
      messagePreview: string;
      workspaceId: string | null;
    }>;
  };
  checklist: PipelineChecklist;
  checklistEvidence: Record<string, string>;
  breakingPoint: PipelineBreakingPoint;
  whyNoReply: string;
  recommendedFix: string[];
};

function previewMessage(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export async function buildWhatsAppPipelineAudit(): Promise<WhatsAppPipelineAudit> {
  const [inboundDiagnostics, inboundHeartbeat, outboundHeartbeat] = await Promise.all([
    getWhatsAppInboundDiagnostics(),
    getInboundHeartbeat(),
    getOutboundHeartbeat(),
  ]);

  let primaryOutbound: "meta" | "evolution" | null = null;
  try {
    primaryOutbound = resolvePrimaryWhatsAppProvider();
  } catch {
    primaryOutbound = null;
  }

  const runtimeOutbound = getOutboundHealthSnapshot();
  const supabase = createAdminClient();

  const [{ data: processedRows }, { data: connectionRows }, { data: conversationRows }] =
    await Promise.all([
      supabase
        .from("processed_whatsapp_messages")
        .select("message_id, instance, remote_jid, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("workspace_whatsapp_connections")
        .select("provider, provider_instance_id, workspace_id, is_active")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("conversations")
        .select("id, lead_id, message, sender, created_at, workspace_id")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const lastProcessed = processedRows?.[0] ?? null;
  const lastClient = conversationRows?.find((row) => row.sender === "client") ?? null;
  const lastAi = conversationRows?.find((row) => row.sender === "ai") ?? null;

  const evolutionBlock = inboundDiagnostics.evolution;
  const connectionState = evolutionBlock?.connectionState?.state ?? null;
  const webhookMatches = evolutionBlock?.webhook?.matchesExpectedUrl ?? null;
  const webhookEnabled = evolutionBlock?.webhook?.enabled ?? null;

  const tenantRoutingConfigured =
    Boolean(connectionRows?.some((row) => row.is_active)) ||
    Boolean(process.env.WHATSAPP_DEFAULT_USER_ID?.trim());

  const inboundStatus = inboundHeartbeat?.last_processing_status ?? null;

  const { checklist, evidence } = buildPipelineChecklist({
    evolutionConfigured: isEvolutionWhatsAppConfigured(),
    connectionState,
    webhookUrlMatches: webhookMatches,
    inboundHeartbeat,
    lastProcessedAt: lastProcessed?.created_at ?? null,
    lastClientConversationAt: lastClient?.created_at ?? null,
    lastAiConversationAt: lastAi?.created_at ?? null,
    primaryOutbound,
    outboundHeartbeat,
    runtimeOutboundSent: Boolean(runtimeOutbound.lastSuccess),
    inboundStatus,
  });

  const { breakingPoint, whyNoReply, recommendedFix } = inferPipelineBreakingPoint({
    evolutionConfigured: isEvolutionWhatsAppConfigured(),
    metaConfigured: isMetaWhatsAppConfigured(),
    primaryOutbound,
    connectionState,
    webhookUrlMatches: webhookMatches,
    webhookEnabled,
    inboundHeartbeat,
    outboundHeartbeat,
    lastProcessedAt: lastProcessed?.created_at ?? null,
    lastClientConversationAt: lastClient?.created_at ?? null,
    lastAiConversationAt: lastAi?.created_at ?? null,
    tenantRoutingConfigured,
    runtimeLastFailureReason: runtimeOutbound.lastFailure?.reason ?? null,
  });

  const inboundChannelNote =
    primaryOutbound === "meta" && isEvolutionWhatsAppConfigured()
      ? "Inbound follows whichever webhook fires (Evolution and/or Meta). Outbound uses Meta when WHATSAPP_PROVIDER=auto/meta and Meta env is set — this commonly breaks Evolution-only business numbers."
      : primaryOutbound === "evolution"
        ? "Inbound and outbound both target Evolution when webhooks are configured on the Evolution instance."
        : "Configure at least one provider.";

  return {
    debugLabel: "whatsapp-pipeline-audit-v1",
    timestamp: new Date().toISOString(),
    provider: {
      mode: getWhatsAppProviderMode(),
      primaryOutbound,
      metaConfigured: isMetaWhatsAppConfigured(),
      evolutionConfigured: isEvolutionWhatsAppConfigured(),
      evolutionFallbackEnabled: isEvolutionFallbackEnabled(),
      inboundChannelNote,
    },
    evolution: {
      instanceName: process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? null,
      connectionState,
      webhookUrlMatches: webhookMatches,
      webhookEnabled,
      expectedWebhookUrl: inboundDiagnostics.env.expectedWebhookUrl,
    },
    meta: {
      configured: isMetaWhatsAppConfigured(),
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ?? null,
    },
    heartbeats: {
      inbound: inboundHeartbeat,
      outbound: outboundHeartbeat,
    },
    runtimeOutbound,
    supabase: {
      lastProcessedMessages: (processedRows ?? []).map((row) => ({
        messageId: row.message_id,
        instance: row.instance,
        remoteJid: row.remote_jid,
        createdAt: row.created_at,
      })),
      workspaceConnections: (connectionRows ?? []).map((row) => ({
        provider: row.provider,
        providerInstanceId: row.provider_instance_id,
        workspaceId: row.workspace_id,
        isActive: row.is_active,
      })),
      recentConversations: (conversationRows ?? []).map((row) => ({
        id: row.id,
        leadId: row.lead_id,
        sender: row.sender,
        createdAt: row.created_at,
        messagePreview: previewMessage(row.message),
        workspaceId: row.workspace_id,
      })),
    },
    checklist,
    checklistEvidence: evidence,
    breakingPoint,
    whyNoReply,
    recommendedFix,
  };
}
