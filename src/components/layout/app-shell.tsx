import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNav, AppNavMobile } from "@/components/layout/app-nav";
import { GridBackground } from "@/components/ui/grid-background";
import { Logo } from "@/components/ui/logo";
import { WorkspacePillFallback } from "@/components/workspaces/workspace-pill";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { getCachedLeadsForInbox } from "@/lib/data/inbox";
import { getProfile } from "@/lib/data/profiles";
import { countNeedsAttentionLeads } from "@/lib/leads/inbox-attention";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let profile = null;
  try {
    profile = await getProfile(supabase, user.id);
  } catch {
    // Profile table may not exist yet — fall back to auth metadata.
  }

  const displayName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Agent";

  let needsAttentionCount = 0;
  try {
    const { workspaceId } = await resolveTenantScope(supabase, user.id);
    const leads = await getCachedLeadsForInbox(supabase, workspaceId, user.id);
    needsAttentionCount = countNeedsAttentionLeads(leads);
  } catch {
    // Inbox badge is best-effort when data layer is unavailable.
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <GridBackground />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Main"
            className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3 md:h-[4.25rem] lg:gap-4"
          >
            <div className="min-w-0 shrink-0">
              <Logo href="/dashboard" />
            </div>

            <div className="hidden min-w-0 justify-center md:flex">
              <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <AppNav needsAttentionCount={needsAttentionCount} />
              </div>
            </div>

            <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-2.5">
              <div className="flex min-w-0 max-w-[min(100%,11rem)] items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] py-1 pl-2 pr-2.5 sm:max-w-[13rem] sm:gap-2.5 sm:pl-2.5 sm:pr-3 lg:max-w-[15rem]">
                <Suspense fallback={<WorkspacePillFallback />}>
                  <WorkspaceSwitcher userId={user.id} />
                </Suspense>
                <span
                  className="hidden min-w-0 truncate text-[11px] text-white/45 lg:inline lg:max-w-[5.5rem] xl:max-w-[7rem]"
                  title={displayName}
                >
                  {displayName}
                </span>
              </div>
              <LogoutButton />
            </div>
          </nav>
        </div>

        <div className="mx-auto max-w-6xl border-t border-white/[0.04] px-4 pb-3 pt-2 md:hidden sm:px-6 lg:px-8">
          <AppNavMobile needsAttentionCount={needsAttentionCount} />
        </div>
      </header>

      <div className="relative z-10 pt-[7.25rem] md:pt-[4.25rem]">{children}</div>
    </div>
  );
}
