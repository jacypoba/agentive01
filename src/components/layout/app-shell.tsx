import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNav, AppNavMobile } from "@/components/layout/app-nav";
import { GridBackground } from "@/components/ui/grid-background";
import { Logo } from "@/components/ui/logo";
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
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <Logo href="/dashboard" />
          <AppNav />
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-sm text-white/50 lg:inline">
              {displayName}
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
