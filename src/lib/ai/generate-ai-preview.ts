import { generateAIReply } from "@/lib/ai/generate-reply";
import { classifyMessageIntent, type MessageIntent } from "@/lib/ai/intent-classifier";
import {
  analyzePreviewContextUsage,
  type AiPreviewContextUsage,
} from "@/lib/ai/preview-context-usage";
import { buildWorkspaceAssistantContext } from "@/lib/ai/workspace-context";
import { resolveReplyLanguage } from "@/lib/i18n/sync-language";
import { getLanguageLabel, type SupportedLanguage } from "@/lib/i18n/types";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { WorkspaceAISettings } from "@/lib/workspace-settings/types";
import type { Conversation, Lead } from "@/types/database";

const PREVIEW_LEAD_ID = "00000000-0000-4000-8000-000000000001";
const PREVIEW_MESSAGE_ID = "00000000-0000-4000-8000-000000000002";

const EMPTY_PREVIEW_AVAILABILITY: PropertyAvailability = {
  matchingTotal: 0,
  shownCount: 0,
  remainingCount: 0,
  toSend: [],
  remainingAfterSend: 0,
  allShown: false,
  noMatchesInDatabase: false,
  criteriaMissing: true,
};

export type AiPreviewResult = {
  reply: string;
  detectedLanguage: SupportedLanguage;
  detectedLanguageLabel: string;
  intent: MessageIntent;
  workspaceContextActive: boolean;
  signals: AiPreviewContextUsage;
};

export function buildPreviewLead(
  workspaceId: string,
  userId: string,
  settings: WorkspaceAISettings
): Lead {
  return {
    id: PREVIEW_LEAD_ID,
    user_id: userId,
    workspace_id: workspaceId,
    client_name: "Preview Lead",
    phone: null,
    phone_normalized: null,
    interest: "WhatsApp inquiry",
    status: "new",
    budget: null,
    preferred_area: null,
    property_type: null,
    timeline: null,
    intent_status: "unknown",
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: settings.defaultLanguage,
    created_at: new Date().toISOString(),
  };
}

export function buildPreviewHistory(
  message: string,
  workspaceId: string
): Conversation[] {
  return [
    {
      id: PREVIEW_MESSAGE_ID,
      lead_id: PREVIEW_LEAD_ID,
      workspace_id: workspaceId,
      message,
      sender: "client",
      created_at: new Date().toISOString(),
    },
  ];
}

export async function generateAiSettingsPreview(
  params: {
    workspaceId: string;
    userId: string;
    settings: WorkspaceAISettings;
    sampleMessage: string;
  }
): Promise<AiPreviewResult> {
  const trimmedMessage = params.sampleMessage.trim();
  if (!trimmedMessage) {
    throw new Error("Sample message is required.");
  }

  const lead = buildPreviewLead(
    params.workspaceId,
    params.userId,
    params.settings
  );
  const history = buildPreviewHistory(trimmedMessage, params.workspaceId);
  const classified = classifyMessageIntent(history, lead);
  const detectedLanguage = resolveReplyLanguage(trimmedMessage, lead);
  const workspaceContextActive = Boolean(
    buildWorkspaceAssistantContext(params.settings, {
      replyLanguage: detectedLanguage,
      latestClientMessage: trimmedMessage,
      isFirstAssistantReply: true,
    })
  );

  const reply = await generateAIReply(
    lead,
    history,
    [],
    EMPTY_PREVIEW_AVAILABILITY,
    false,
    false,
    classified.intent,
    detectedLanguage,
    params.settings
  );

  const finalReply =
    reply.trim() ||
    "The assistant did not produce a reply for this preview (empty or filtered output).";

  const signals = analyzePreviewContextUsage(
    params.settings,
    trimmedMessage,
    finalReply
  );

  return {
    reply: finalReply,
    detectedLanguage,
    detectedLanguageLabel: getLanguageLabel(detectedLanguage),
    intent: classified.intent,
    workspaceContextActive,
    signals,
  };
}
