"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  cancelFollowUpAction,
  markFollowUpSentAction,
  sendFollowUpByIdAction,
} from "@/app/actions/follow-ups";
import {
  formatFollowUpDateTime,
  getFollowUpStatusColor,
  getFollowUpTypeLabel,
} from "@/lib/follow-ups/display";
import type { FollowUpBuckets, FollowUpWithLead } from "@/types/database";

type FollowUpsListProps = {
  buckets: FollowUpBuckets;
  dbError?: string | null;
  initialGroup?: GroupFilter;
};

type GroupFilter = "pending" | "sent" | "failed";

function FollowUpActions({
  item,
  pendingId,
  isPending,
  onAction,
}: {
  item: FollowUpWithLead;
  pendingId: string | null;
  isPending: boolean;
  onAction: (
    followUpId: string,
    action: "send" | "mark_sent" | "cancel"
  ) => void;
}) {
  const isLoading = isPending && pendingId === item.id;
  const canSend = item.status === "pending" || item.status === "failed";
  const canMarkSent = item.status === "pending" || item.status === "failed";
  const canCancel = item.status === "pending";

  if (!canSend && !canMarkSent && !canCancel) {
    return <span className="text-xs text-white/30">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canSend && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction(item.id, "send")}
          className="rounded-full border border-[#0066FF]/40 bg-[#0066FF]/10 px-3 py-1 text-xs font-medium text-[#00D4FF] transition hover:bg-[#0066FF]/20 disabled:opacity-50"
        >
          {isLoading ? "Sending…" : "Send now"}
        </button>
      )}
      {canMarkSent && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction(item.id, "mark_sent")}
          className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-50"
        >
          Mark sent
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction(item.id, "cancel")}
          className="rounded-full border border-red-500/20 px-3 py-1 text-xs text-red-300/80 transition hover:border-red-500/40 hover:text-red-200 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function FollowUpCard({
  item,
  pendingId,
  isPending,
  onAction,
}: {
  item: FollowUpWithLead;
  pendingId: string | null;
  isPending: boolean;
  onAction: (
    followUpId: string,
    action: "send" | "mark_sent" | "cancel"
  ) => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/15">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/leads/${item.lead_id}`}
              className="text-base font-semibold text-white hover:text-[#00D4FF]"
            >
              {item.leads.client_name}
            </Link>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium capitalize ${getFollowUpStatusColor(item.status)}`}
            >
              {item.status}
            </span>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Phone
              </dt>
              <dd className="mt-0.5 text-white/75">
                {item.leads.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Type
              </dt>
              <dd className="mt-0.5 text-white/75">
                {getFollowUpTypeLabel(item.type)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Scheduled for
              </dt>
              <dd className="mt-0.5 text-white/75">
                {formatFollowUpDateTime(item.scheduled_for)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Created
              </dt>
              <dd className="mt-0.5 text-white/75">
                {formatFollowUpDateTime(item.created_at)}
              </dd>
            </div>
          </dl>

          {item.message && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Message preview
              </p>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-white/50">
                {item.message}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 lg:pt-1">
          <FollowUpActions
            item={item}
            pendingId={pendingId}
            isPending={isPending}
            onAction={onAction}
          />
        </div>
      </div>
    </article>
  );
}

export function FollowUpsList({
  buckets,
  dbError,
  initialGroup = "pending",
}: FollowUpsListProps) {
  const [group, setGroup] = useState<GroupFilter>(initialGroup);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      pending: buckets.pending.length,
      sent: buckets.sent.length,
      failed: buckets.failed.length,
    }),
    [buckets]
  );

  const items = useMemo(() => {
    return buckets[group];
  }, [buckets, group]);

  function handleAction(
    followUpId: string,
    action: "send" | "mark_sent" | "cancel"
  ) {
    setError(null);
    setSuccessMessage(null);
    setPendingId(followUpId);

    startTransition(async () => {
      const result =
        action === "send"
          ? await sendFollowUpByIdAction(followUpId)
          : action === "mark_sent"
            ? await markFollowUpSentAction(followUpId)
            : await cancelFollowUpAction(followUpId);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setSuccessMessage(result.success);
      }

      setPendingId(null);
    });
  }

  const filters: { key: GroupFilter; label: string }[] = [
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "sent", label: `Sent (${counts.sent})` },
    { key: "failed", label: `Failed (${counts.failed})` },
  ];

  return (
    <div>
      {dbError && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200"
        >
          <p className="font-medium">Database not ready</p>
          <p className="mt-1 text-amber-200/80">
            Run migration{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              supabase/migrations/011_follow_ups.sql
            </code>{" "}
            in the Supabase SQL Editor, then refresh.
          </p>
          <p className="mt-2 text-xs text-amber-200/60">{dbError}</p>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200"
        >
          {successMessage}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setGroup(filter.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              group === filter.key
                ? "bg-gradient-to-r from-[#0066FF] to-[#0088FF] text-white shadow-lg shadow-[#0066FF]/20"
                : "border border-white/10 text-white/50 hover:border-white/20 hover:text-white"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-sm text-white/50">
            No {group} follow-ups yet.
          </p>
          <p className="mt-1 text-xs text-white/30">
            Automated follow-ups appear here when leads go quiet or visits need
            a nudge.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <FollowUpCard
              key={item.id}
              item={item}
              pendingId={pendingId}
              isPending={isPending}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
