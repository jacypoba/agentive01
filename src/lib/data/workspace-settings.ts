import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupportedLanguage,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/lib/i18n/types";
import type {
  WorkspaceAISettings,
  WorkspaceAISettingsInput,
  WorkspaceFaqItem,
} from "@/lib/workspace-settings/types";
import type { Database, WorkspaceSettings } from "@/types/database";

type Client = SupabaseClient<Database>;

function firstRow<T>(rows: T[] | null | undefined): T | null {
  return rows?.[0] ?? null;
}

function parseFaqItems(value: unknown): WorkspaceFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: WorkspaceFaqItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const question =
      typeof (entry as { question?: unknown }).question === "string"
        ? (entry as { question: string }).question.trim()
        : "";
    const answer =
      typeof (entry as { answer?: unknown }).answer === "string"
        ? (entry as { answer: string }).answer.trim()
        : "";
    if (!question && !answer) {
      continue;
    }
    items.push({ question, answer });
  }
  return items;
}

function parsePreferredLanguages(value: unknown): SupportedLanguage[] {
  if (!Array.isArray(value)) {
    return ["en"];
  }

  const languages: SupportedLanguage[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && isSupportedLanguage(entry.trim())) {
      const code = entry.trim() as SupportedLanguage;
      if (!languages.includes(code)) {
        languages.push(code);
      }
    }
  }

  return languages.length > 0 ? languages : ["en"];
}

export function mapWorkspaceSettingsRow(
  row: WorkspaceSettings
): WorkspaceAISettings {
  const preferredLanguages = parsePreferredLanguages(row.preferred_languages);
  const defaultLanguage = isSupportedLanguage(row.default_language)
    ? row.default_language
    : preferredLanguages[0] ?? "en";

  return {
    workspaceId: row.workspace_id,
    businessName: row.business_name?.trim() ?? "",
    businessInfo: row.business_info?.trim() ?? "",
    toneOfVoice: row.tone_of_voice?.trim() ?? "",
    areasServed: row.areas_served?.trim() ?? "",
    preferredLanguages,
    defaultLanguage: normalizeLanguage(defaultLanguage, preferredLanguages[0] ?? "en"),
    faqs: parseFaqItems(row.faqs),
    officeHours: row.office_hours?.trim() ?? "",
    agentBehaviorRules: row.agent_behavior_rules?.trim() ?? "",
    greetingStyle: row.greeting_style?.trim() ?? "",
    followUpStyle: row.follow_up_style?.trim() ?? "",
    updatedAt: row.updated_at ?? null,
  };
}

export function toWorkspaceSettingsUpdate(
  input: WorkspaceAISettingsInput
): Database["public"]["Tables"]["workspace_settings"]["Update"] {
  return {
    business_name: input.businessName || null,
    business_info: input.businessInfo || null,
    tone_of_voice: input.toneOfVoice || null,
    areas_served: input.areasServed || null,
    preferred_languages: input.preferredLanguages,
    default_language: input.defaultLanguage,
    faqs: input.faqs,
    office_hours: input.officeHours || null,
    agent_behavior_rules: input.agentBehaviorRules || null,
    greeting_style: input.greetingStyle || null,
    follow_up_style: input.followUpStyle || null,
    updated_at: new Date().toISOString(),
  };
}

export async function ensureWorkspaceSettingsRow(
  supabase: Client,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase.rpc("ensure_workspace_settings", {
    p_workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(`Failed to ensure workspace settings: ${error.message}`);
  }
}

export async function getWorkspaceSettings(
  supabase: Client,
  workspaceId: string
): Promise<WorkspaceAISettings | null> {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch workspace settings: ${error.message}`);
  }

  const row = firstRow(data);
  if (!row) {
    return null;
  }

  return mapWorkspaceSettingsRow(row);
}

export async function getOrCreateWorkspaceSettings(
  supabase: Client,
  workspaceId: string
): Promise<WorkspaceAISettings> {
  let settings = await getWorkspaceSettings(supabase, workspaceId);
  if (settings) {
    return settings;
  }

  await ensureWorkspaceSettingsRow(supabase, workspaceId);
  settings = await getWorkspaceSettings(supabase, workspaceId);

  if (!settings) {
    throw new Error("Workspace settings row could not be loaded.");
  }

  return settings;
}

export async function updateWorkspaceSettings(
  supabase: Client,
  workspaceId: string,
  input: WorkspaceAISettingsInput
): Promise<WorkspaceAISettings> {
  await ensureWorkspaceSettingsRow(supabase, workspaceId);

  const { data, error } = await supabase
    .from("workspace_settings")
    .update(toWorkspaceSettingsUpdate(input))
    .eq("workspace_id", workspaceId)
    .select("*");

  if (error) {
    throw new Error(`Failed to update workspace settings: ${error.message}`);
  }

  const row = firstRow(data);
  if (!row) {
    throw new Error("Workspace settings update returned no row.");
  }

  return mapWorkspaceSettingsRow(row);
}

export function hasWorkspaceAICustomization(
  settings: WorkspaceAISettings | null | undefined
): boolean {
  if (!settings) {
    return false;
  }

  return Boolean(
    settings.businessName ||
      settings.businessInfo ||
      settings.toneOfVoice ||
      settings.areasServed ||
      settings.officeHours ||
      settings.agentBehaviorRules ||
      settings.greetingStyle ||
      settings.followUpStyle ||
      settings.faqs.length > 0
  );
}

export function hasWorkspaceFollowUpCustomization(
  settings: WorkspaceAISettings | null | undefined
): boolean {
  if (!settings) {
    return false;
  }

  return Boolean(
    settings.toneOfVoice ||
      settings.followUpStyle ||
      settings.businessName ||
      settings.agentBehaviorRules
  );
}
