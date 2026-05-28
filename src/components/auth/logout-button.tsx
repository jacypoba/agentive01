"use client";

import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="shrink-0 whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-all hover:border-white/25 hover:bg-white/10 sm:px-4 sm:py-2 sm:text-sm"
      >
        Sign out
      </button>
    </form>
  );
}
