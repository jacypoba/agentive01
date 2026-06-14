"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { reassignLeadAction } from "@/app/actions/leads";
import { getAssigneeLabel } from "@/lib/leads/member-display";
import type { WorkspaceMemberWithProfile } from "@/lib/data/workspace-members";

type LeadAssignmentPanelProps = {
  leadId: string;
  assignedUserId: string | null;
  members: WorkspaceMemberWithProfile[];
  memberLabels: Record<string, string>;
  canReassign: boolean;
};

export function LeadAssignmentPanel({
  leadId,
  assignedUserId,
  members,
  memberLabels,
  canReassign,
}: LeadAssignmentPanelProps) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(
    assignedUserId ?? ""
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedUserId(assignedUserId ?? "");
  }, [assignedUserId, leadId]);

  const labelMap = new Map(Object.entries(memberLabels));
  const currentLabel = getAssigneeLabel(assignedUserId, labelMap);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const nextAssignedUserId = selectedUserId.trim() || null;

    startTransition(async () => {
      const result = await reassignLeadAction(leadId, nextAssignedUserId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(result.success ?? "Lead assignment updated.");
      router.refresh();
    });
  }

  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
        Assigned to
      </h2>

      {canReassign ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={isPending}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20 disabled:opacity-60"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {memberLabels[member.user_id] ?? "Team member"}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex rounded-full border border-[#0066FF]/40 bg-[#0066FF]/20 px-4 py-2 text-xs font-medium text-[#00D4FF] transition-all hover:border-[#0066FF]/60 hover:bg-[#0066FF]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save assignment"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-white/80">{currentLabel}</p>
      )}

      {message && (
        <p className="mt-3 text-xs text-emerald-300/90">{message}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300/90">
          {error}
        </p>
      )}
    </div>
  );
}
