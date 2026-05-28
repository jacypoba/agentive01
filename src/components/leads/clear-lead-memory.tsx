"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { clearLeadMemoryAction } from "@/app/actions/leads";

type ClearLeadMemoryPanelProps = {
  leadId: string;
};

export function ClearLeadMemoryPanel({ leadId }: ClearLeadMemoryPanelProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [resetQualification, setResetQualification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  function handleOpen() {
    setResetQualification(false);
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handleConfirm() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await clearLeadMemoryAction(leadId, resetQualification);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setMessage(result.success ?? "Lead memory cleared.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
      <h2 className="text-sm font-semibold text-white">Testing & support</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/45">
        Clear WhatsApp conversation memory so the AI starts fresh — useful when
        re-testing languages or property flows on the same number.
      </p>

      {message && (
        <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-200">
          {message}
        </p>
      )}

      {error && !open && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleOpen}
        className="mt-4 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-100 transition hover:border-amber-500/50 hover:bg-amber-500/15"
      >
        Clear memory
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 z-50 m-auto w-[min(100%,28rem)] rounded-2xl border border-white/10 bg-[#0a0a0a] p-0 text-white shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            handleClose();
          }}
          className="p-6"
        >
          <h3 className="text-lg font-semibold tracking-tight">
            Clear lead memory?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            This removes the full WhatsApp conversation history for this lead
            and cancels pending follow-ups. The AI will forget prior messages,
            property cards sent, and catalog context.
          </p>

          <ul className="mt-4 space-y-1.5 text-xs text-white/45">
            <li>• Conversation messages — deleted</li>
            <li>• Shown property / catalog state — reset</li>
            <li>• Pending follow-ups — cancelled</li>
            <li>• Lead name, phone, visits, calendar — kept</li>
          </ul>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <input
              type="checkbox"
              checked={resetQualification}
              onChange={(event) => setResetQualification(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent accent-[#0066FF]"
            />
            <span className="text-sm leading-relaxed text-white/75">
              Also reset qualification fields
              <span className="mt-1 block text-xs text-white/40">
                budget, area, property type, timeline, intent, visit flags,
                preferred language
              </span>
            </span>
          </label>

          {error && open && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirm}
              className="rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50"
            >
              {isPending ? "Clearing…" : "Clear memory"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
