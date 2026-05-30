import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceId } from "@/lib/workspaces/get-current-workspace";
import type { WhatsAppProviderId } from "@/lib/whatsapp/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type WhatsAppTenantContext = {
  workspaceId: string;
  defaultUserId: string;
  provider: WhatsAppProviderId;
  providerInstanceId: string;
  routingSource: "connection_table" | "env_fallback";
};

function getEnvDefaultUserId(): string | null {
  return process.env.WHATSAPP_DEFAULT_USER_ID?.trim() ?? null;
}

async function resolveFromConnectionTable(
  supabase: Client,
  provider: WhatsAppProviderId,
  providerInstanceId: string
): Promise<WhatsAppTenantContext | null> {
  const { data, error } = await supabase
    .from("workspace_whatsapp_connections")
    .select("workspace_id, default_user_id, provider, provider_instance_id")
    .eq("provider", provider)
    .eq("provider_instance_id", providerInstanceId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    workspaceId: data.workspace_id,
    defaultUserId: data.default_user_id,
    provider: data.provider as WhatsAppProviderId,
    providerInstanceId: data.provider_instance_id,
    routingSource: "connection_table",
  };
}

async function resolveFromEnvFallback(
  supabase: Client,
  provider: WhatsAppProviderId,
  providerInstanceId: string
): Promise<WhatsAppTenantContext | null> {
  const defaultUserId = getEnvDefaultUserId();
  if (!defaultUserId) {
    return null;
  }

  const workspaceId = await getCurrentWorkspaceId(supabase, defaultUserId);
  if (!workspaceId) {
    return null;
  }

  return {
    workspaceId,
    defaultUserId,
    provider,
    providerInstanceId,
    routingSource: "env_fallback",
  };
}

/**
 * Maps an inbound WhatsApp webhook (Meta phone_number_id or Evolution instance)
 * to exactly one workspace and default agent user.
 */
export async function resolveWhatsAppTenantContext(input: {
  provider: WhatsAppProviderId;
  providerInstanceId: string;
  supabase?: Client;
}): Promise<WhatsAppTenantContext> {
  const supabase = input.supabase ?? createAdminClient();
  const instanceId = input.providerInstanceId.trim();

  if (!instanceId) {
    throw new Error("WhatsApp provider instance id is required for tenant routing.");
  }

  const fromTable = await resolveFromConnectionTable(
    supabase,
    input.provider,
    instanceId
  );
  if (fromTable) {
    return fromTable;
  }

  const fromEnv = await resolveFromEnvFallback(supabase, input.provider, instanceId);
  if (fromEnv) {
    console.warn("[WHATSAPP TENANT ROUTING] Using WHATSAPP_DEFAULT_USER_ID fallback", {
      provider: input.provider,
      providerInstanceId: instanceId,
      workspaceId: fromEnv.workspaceId,
    });
    return fromEnv;
  }

  throw new Error(
    `No workspace mapped for WhatsApp ${input.provider} instance "${instanceId}". ` +
      "Add a row to workspace_whatsapp_connections or set WHATSAPP_DEFAULT_USER_ID."
  );
}
