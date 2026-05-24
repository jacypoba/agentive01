"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const fullName = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;

    if (!fullName || !email || !password) {
      setError("All fields are required.");
      setPending(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setPending(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    setPending(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user && !data.session) {
      setSuccess(
        "Account created! Check your email to confirm, then sign in."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-4 py-3 text-sm text-[#00D4FF]"
        >
          {success}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-xs font-medium text-white/60">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Alex Morgan"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20"
        />
      </div>

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
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Min. 8 characters"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group relative w-full overflow-hidden rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0066FF]/25 transition-all hover:shadow-[#0066FF]/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="relative z-10">
          {pending ? "Creating account…" : "Create account"}
        </span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </button>

      <p className="text-center text-sm text-white/40">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[#00D4FF] transition-colors hover:text-white"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
