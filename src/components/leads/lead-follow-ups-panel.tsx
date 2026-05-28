"use client";

import { useState, useTransition } from "react";
import { triggerFollowUpNowAction } from "@/app/actions/follow-ups";

type LeadFollowUpsPanelProps = {
  leadId: string;
};

export function LeadFollowUpsPanel({ leadId }: LeadFollowUpsPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTrigger(type: "silent_lead" | "property_recommended" | "new_match") {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await triggerFollowUpNowAction(leadId, type);
      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setMessage(result.success);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-semibold text-white">Follow-ups</h2>
      <p className="mt-1 text-xs text-white/45">
        Send a contextual WhatsApp nudge manually.
      </p>

      {message && (
        <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleTrigger("silent_lead")}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-[#0066FF]/40 hover:text-white disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Re-engage"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleTrigger("property_recommended")}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-[#0066FF]/40 hover:text-white disabled:opacity-50"
        >
          Ask about property
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleTrigger("new_match")}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-[#0066FF]/40 hover:text-white disabled:opacity-50"
        >
          New match teaser
        </button>
      </div>
    </section>
  );
}
