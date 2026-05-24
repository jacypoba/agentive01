import Link from "next/link";

type LogoProps = {
  href?: string;
};

export function Logo({ href = "/" }: LogoProps) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#0066FF] to-[#00D4FF] opacity-60 blur-sm transition-opacity group-hover:opacity-100" />
        <span className="relative text-xs font-bold tracking-tighter text-white">
          A1
        </span>
      </span>
      <span className="text-sm font-semibold tracking-tight text-white">
        Agentive<span className="text-[#00D4FF]">01</span>
      </span>
    </Link>
  );
}
