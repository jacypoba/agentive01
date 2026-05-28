import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNav, AppNavMobile } from "@/components/layout/app-nav";
import { GridBackground } from "@/components/ui/grid-background";
import { Logo } from "@/components/ui/logo";
import { WorkspacePillFallback } from "@/components/workspaces/workspace-pill";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { getProfile } from "@/lib/data/profiles";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <GridBackground />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 lg:px-8">
          <div className="shrink-0">
            <Logo href="/dashboard" />
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto md:overflow-visible">
            <AppNav />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="max-w-[120px] truncate text-sm text-white/50 md:max-w-[140px]">
              {displayName}
            </span>
            <Suspense fallback={<WorkspacePillFallback />}>
              <WorkspaceSwitcher userId={user.id} />
            </Suspense>
            <span
              className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-lime-400"
              data-testid="workspace-test-marker"
            >
              WORKSPACE TEST
            </span>
            <LogoutButton />
          </div>
        </nav>
        <div className="mx-auto max-w-6xl px-6 pb-3 md:hidden lg:px-8">
          <AppNavMobile />
        </div>
      </header>

      <div className="relative z-10 pt-28 md:pt-24">{children}</div>
    </div>
  );
}
