"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/visits", label: "Visits" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/properties", label: "Properties" },
  { href: "/settings/ai", label: "AI Assistant" },
  { href: "/settings/calendar", label: "Calendar" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-max items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5 md:flex lg:gap-1 lg:p-1">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all lg:px-3.5 lg:py-1.5 lg:text-sm ${
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
