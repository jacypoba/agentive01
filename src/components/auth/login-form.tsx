"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full overflow-hidden rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0066FF]/25 transition-all hover:shadow-[#0066FF]/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="relative z-10">
        {pending ? "Signing in…" : "Sign in"}
      </span>
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
    </button>
  );
}

export function LoginForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirect" value={redirectTo} />
      {state.error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-xs font-medium text-white/60">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@agency.com"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-xs font-medium text-white/60">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20"
        />
      </div>

      <SubmitButton pending={pending} />

      <p className="text-center text-sm text-white/40">
        Don&apos;t have an account?{" "}
        <Link
          href={
            redirectTo === "/dashboard"
              ? "/signup"
              : `/signup?redirect=${encodeURIComponent(redirectTo)}`
          }
          className="font-medium text-[#00D4FF] transition-colors hover:text-white"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
