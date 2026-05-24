"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-[#0066FF] to-[#0088FF] text-white shadow-lg shadow-[#0066FF]/20"
                : "text-white/50 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppNavMobile() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 md:hidden">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? "border border-[#0066FF]/40 bg-[#0066FF]/20 text-[#00D4FF]"
                : "border border-white/10 text-white/50"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
