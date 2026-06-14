import Link from "next/link";
import { LanguageBadge } from "@/components/leads/language-badge";
import { formatRelativeTime } from "@/lib/data/dashboard";
import {
  formatInboxMessagePreview,
  formatInboxSenderLabel,
  formatUnreadBadgeCount,
  shouldShowUnreadBadge,
} from "@/lib/leads/inbox-display";
import { getStatusBadgeColor } from "@/lib/leads/status";
import type { LeadForInbox } from "@/types/database";

type LeadInboxCardProps = {
  lead: LeadForInbox;
  assigneeLabel: string;
};

export function LeadInboxCard({ lead, assigneeLabel }: LeadInboxCardProps) {
  const senderLabel = formatInboxSenderLabel(lead.last_message_sender);
  const preview = formatInboxMessagePreview(lead.last_message_text);
  const showUnread = shouldShowUnreadBadge(lead.unread_count);

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="group block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-[#0066FF]/30 hover:bg-[#0066FF]/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-white group-hover:text-[#00D4FF]">
              {lead.client_name}
            </h3>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${getStatusBadgeColor(lead.status)}`}
            >
              {lead.status}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-white/60">{preview}</p>

          {senderLabel && (
            <p className="mt-1 text-xs text-white/35">
              <span className="font-medium text-white/45">{senderLabel}</span>
              {lead.last_message_at && (
                <>
                  {" · "}
                  {formatRelativeTime(lead.last_message_at)}
                </>
              )}
            </p>
          )}

          {!senderLabel && lead.last_message_at && (
            <p className="mt-1 text-xs text-white/35">
              {formatRelativeTime(lead.last_message_at)}
            </p>
          )}
        </div>

        {showUnread && (
          <span
            aria-label={`${lead.unread_count} unread messages`}
            className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[#0066FF] px-1.5 text-[11px] font-semibold text-white"
          >
            {formatUnreadBadgeCount(lead.unread_count)}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-3 text-xs text-white/45">
        <span>{assigneeLabel}</span>
        {lead.phone && (
          <>
            <span className="text-white/20">·</span>
            <span>{lead.phone}</span>
          </>
        )}
        {lead.preferred_language && (
          <LanguageBadge language={lead.preferred_language} />
        )}
      </div>
    </Link>
  );
}
