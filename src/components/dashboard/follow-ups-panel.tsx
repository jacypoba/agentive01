import Link from "next/link";
import { formatRelativeTime } from "@/lib/data/dashboard";
import type { FollowUpBuckets } from "@/types/database";

type FollowUpsPanelProps = {
  buckets: FollowUpBuckets;
};

function FollowUpRow({
  clientName,
  when,
  type,
  status,
  leadId,
  message,
}: {
  clientName: string;
  when: string;
  type: string;
  status: string;
  leadId: string;
  message?: string | null;
}) {
  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/leads/${leadId}`}
            className="text-sm font-medium text-white hover:text-[#00D4FF]"
          >
            {clientName}
          </Link>
          <p className="mt-1 text-xs text-white/45">{when}</p>
          {message && (
            <p className="mt-1 line-clamp-2 text-xs text-white/35">{message}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] capitalize text-white/50">
          {type.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-white/25">
        {status}
      </p>
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FollowUpsPanel({ buckets }: FollowUpsPanelProps) {
  return (
    <section className="mt-12">
      <div>
        <h2 className="text-lg font-semibold">Follow-ups</h2>
        <p className="mt-1 text-sm text-white/45">
          Automated WhatsApp re-engagement — pending, sent, and failed.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Pending</h3>
          <div className="mt-2 divide-y divide-white/5">
            {buckets.pending.length === 0 ? (
              <p className="py-4 text-xs text-white/35">No pending follow-ups.</p>
            ) : (
              buckets.pending.map((item) => (
                <FollowUpRow
                  key={item.id}
                  clientName={item.leads.client_name}
                  when={formatWhen(item.scheduled_for)}
                  type={item.type}
                  status={item.status}
                  leadId={item.lead_id}
                  message={item.message}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Sent</h3>
          <div className="mt-2 divide-y divide-white/5">
            {buckets.sent.length === 0 ? (
              <p className="py-4 text-xs text-white/35">No sent follow-ups yet.</p>
            ) : (
              buckets.sent.map((item) => (
                <FollowUpRow
                  key={item.id}
                  clientName={item.leads.client_name}
                  when={
                    item.sent_at
                      ? formatRelativeTime(item.sent_at)
                      : formatWhen(item.created_at)
                  }
                  type={item.type}
                  status={item.status}
                  leadId={item.lead_id}
                  message={item.message}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Failed</h3>
          <div className="mt-2 divide-y divide-white/5">
            {buckets.failed.length === 0 ? (
              <p className="py-4 text-xs text-white/35">No failed follow-ups.</p>
            ) : (
              buckets.failed.map((item) => (
                <FollowUpRow
                  key={item.id}
                  clientName={item.leads.client_name}
                  when={formatWhen(item.created_at)}
                  type={item.type}
                  status={item.status}
                  leadId={item.lead_id}
                  message={item.message}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
