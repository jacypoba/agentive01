"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/settings/ai", label: "AI Assistant" },
  { href: "/settings/calendar", label: "Calendar" },
  { href: "/settings/team", label: "Team" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex flex-wrap gap-2">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-[#0066FF] to-[#0088FF] text-white shadow-lg shadow-[#0066FF]/20"
                : "border border-white/10 text-white/50 hover:border-white/20 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
