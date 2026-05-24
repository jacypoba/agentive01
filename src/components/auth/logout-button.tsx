"use client";

import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-white transition-all hover:border-white/25 hover:bg-white/10"
      >
        Sign out
      </button>
    </form>
  );
}
