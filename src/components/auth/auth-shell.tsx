import { GridBackground } from "@/components/ui/grid-background";
import { Logo } from "@/components/ui/logo";

type AuthShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
};

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black text-white">
      <GridBackground />

      <header className="relative z-10 border-b border-white/5 bg-black/40 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo />
          <a
            href="/"
            className="text-sm text-white/50 transition-colors hover:text-white"
          >
            Back to home
          </a>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 text-center">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D4FF] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D4FF]" />
              </span>
              Secure access
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              {subtitle}
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#0066FF]/50 via-[#00D4FF]/20 to-transparent opacity-70" />
            <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0a]/90 p-8 shadow-2xl shadow-[#0066FF]/10 backdrop-blur-xl">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
