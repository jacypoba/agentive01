import OpenAI from "openai";
import {
  buildWorkspaceFollowUpAdaptationPrompt,
} from "@/lib/ai/workspace-context";
import {
  getOrCreateWorkspaceSettings,
  hasWorkspaceFollowUpCustomization,
} from "@/lib/data/workspace-settings";
import { generateFollowUpMessage } from "@/lib/follow-ups/messages";
import { buildFollowUpContextSummary } from "@/lib/follow-ups/context";
import { finalizeWhatsAppText } from "@/lib/ai/complete-response";
import { getLanguageLabel, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FollowUpContextSnapshot, FollowUpType } from "@/types/database";

type Client = SupabaseClient<Database>;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

export async function generateFollowUpMessageForWorkspace(
  supabase: Client,
  workspaceId: string,
  type: FollowUpType,
  context: FollowUpContextSnapshot,
  seed: string,
  language: SupportedLanguage = "pt"
): Promise<string> {
  const lang = normalizeLanguage(context.preferred_language ?? language);
  const template = generateFollowUpMessage(type, context, seed, lang);

  const settings = await getOrCreateWorkspaceSettings(supabase, workspaceId);
  if (!hasWorkspaceFollowUpCustomization(settings)) {
    return template;
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return template;
  }

  const contextSummary = buildFollowUpContextSummary(context);
  const prompt = buildWorkspaceFollowUpAdaptationPrompt(
    settings,
    getLanguageLabel(lang),
    type,
    template,
    contextSummary
  );

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.72,
      max_tokens: 90,
    });

    const adapted = completion.choices[0]?.message?.content?.trim();
    if (!adapted) {
      return template;
    }

    const finalized = finalizeWhatsAppText(adapted);
    return finalized || template;
  } catch (error) {
    console.warn("[Follow-ups] Workspace tone adaptation failed — using template", {
      workspaceId,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return template;
  }
}
