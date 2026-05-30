import type { Metadata } from "next";
import { AiAssistantSettingsForm } from "@/components/settings/ai-assistant-settings-form";
import { SettingsNav } from "@/components/settings/settings-nav";
import { getOrCreateWorkspaceSettings } from "@/lib/data/workspace-settings";
import { getCurrentWorkspace } from "@/lib/workspaces/get-current-workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI Assistant — Agentive01",
};

const ADMIN_ROLES = new Set(["owner", "admin"]);

export default async function AiAssistantSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dbError: string | null = null;
  let workspaceName = "Workspace";
  let canEdit = false;
  let settings = null;

  if (user) {
    try {
      const workspace = await getCurrentWorkspace(supabase, user.id);
      if (!workspace) {
        dbError = "No active workspace found. Complete onboarding first.";
      } else {
        workspaceName = workspace.name;
        canEdit = ADMIN_ROLES.has(workspace.role);
        settings = await getOrCreateWorkspaceSettings(supabase, workspace.id);
      }
    } catch (error) {
      dbError =
        error instanceof Error ? error.message : "Could not load AI settings.";
    }
  }

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="animate-fade-up">
          <p className="text-xs font-medium uppercase tracking-wider text-[#00D4FF]">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            AI Assistant
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Configure how your workspace AI speaks, qualifies leads, and follows up
            on WhatsApp.
          </p>
          <SettingsNav />
        </section>

        {dbError && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
            {dbError.includes("workspace_settings") ||
            dbError.includes("ensure_workspace_settings") ? (
              <>
                Run{" "}
                <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                  supabase/migrations/019_workspace_settings_ai_fields.sql
                </code>{" "}
                first. {dbError}
              </>
            ) : (
              dbError
            )}
          </div>
        )}

        {settings && (
          <div className="mt-8">
            <AiAssistantSettingsForm
              workspaceName={workspaceName}
              settings={settings}
              canEdit={canEdit}
            />
          </div>
        )}
      </div>
    </main>
  );
}
