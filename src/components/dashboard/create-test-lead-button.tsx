"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTestLead } from "@/app/actions/leads";

export function CreateTestLeadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      const result = await createTestLead();
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }
      setFeedback({
        type: "success",
        message: result.success ?? "Test lead created.",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="group relative overflow-hidden rounded-full border border-[#0066FF]/40 bg-[#0066FF]/10 px-4 py-2 text-xs font-semibold text-[#00D4FF] transition-all hover:border-[#0066FF]/60 hover:bg-[#0066FF]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      >
        <span className="relative z-10 flex items-center gap-2">
          {pending ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#00D4FF]/30 border-t-[#00D4FF]" />
              Creating…
            </>
          ) : (
            <>
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Create test lead
            </>
          )}
        </span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </button>
      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`max-w-xs text-right text-xs ${
            feedback.type === "error" ? "text-red-400" : "text-[#00D4FF]"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
