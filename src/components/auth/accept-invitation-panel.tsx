"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { switchAccountForInviteAction } from "@/app/actions/auth";
import { acceptInvitationAction } from "@/app/actions/team";
import type { InvitationPreview } from "@/app/actions/team";

type AcceptInvitationPanelProps = {
  token: string;
  preview: InvitationPreview;
  isAuthenticated: boolean;
  userEmail: string | null;
  redirectPath: string;
};

export function AcceptInvitationPanel({
  token,
  preview,
  isAuthenticated,
  userEmail,
  redirectPath,
}: AcceptInvitationPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const emailMatches =
    userEmail != null &&
    userEmail.toLowerCase() === preview.email.toLowerCase();

  function handleAccept() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await acceptInvitationAction(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Invitation accepted.");
      router.push("/dashboard");
      router.refresh();
    });
  }


  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-[#00D4FF]">
          Workspace invitation
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Join {preview.workspaceName}
        </h1>
        <p className="mt-3 text-sm text-white/50">
          You&apos;ve been invited as{" "}
          <span className="capitalize text-white/70">{preview.role}</span> (
          {preview.email}).
        </p>
        <p className="mt-2 text-xs text-white/35">
          {preview.expired
            ? "This invitation has expired."
            : `Valid until ${new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(preview.expiresAt))}`}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          {message}
        </div>
      )}

      {!preview.canAccept && (
        <p className="text-center text-sm text-white/45">
          Ask a workspace admin to send a new invitation.
        </p>
      )}

      {preview.canAccept && !isAuthenticated && (
        <div className="space-y-3 text-center text-sm">
          <p className="text-white/50">
            Sign in or create an account with{" "}
            <span className="text-white/80">{preview.email}</span> to accept.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
              className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-5 py-2.5 font-medium text-white"
            >
              Sign in
            </Link>
            <Link
              href={`/signup?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(preview.email)}`}
              className="rounded-full border border-white/15 px-5 py-2.5 font-medium text-white/80 hover:bg-white/5"
            >
              Create account
            </Link>
          </div>
        </div>
      )}

      {preview.canAccept && isAuthenticated && !emailMatches && (
        <div className="space-y-3 text-center text-sm text-white/50">
          <p>
            You are signed in as {userEmail ?? "another account"}. Sign in with{" "}
            {preview.email} to accept.
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <form action={switchAccountForInviteAction}>
              <input type="hidden" name="redirect" value={redirectPath} />
              <button
                type="submit"
                className="rounded-full border border-white/15 px-5 py-2.5 font-medium text-white/80 transition hover:bg-white/5"
              >
                Switch account
              </button>
            </form>
            <Link
              href={`/signup?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(preview.email)}`}
              className="rounded-full border border-white/15 px-5 py-2.5 font-medium text-white/80 hover:bg-white/5"
            >
              Create account
            </Link>
          </div>
        </div>
      )}

      {preview.canAccept && isAuthenticated && emailMatches && (
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          className="w-full rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Joining…" : "Accept invitation"}
        </button>
      )}
    </div>
  );
}
