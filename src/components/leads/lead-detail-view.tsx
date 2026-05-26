import Link from "next/link";
import { ConversationPanel } from "@/components/leads/conversation-panel";
import { LeadQualificationSummary } from "@/components/leads/lead-qualification-summary";
import { formatLeadDate, getStatusBadgeColor } from "@/lib/leads/status";
import type { Conversation, Lead } from "@/types/database";

type LeadDetailViewProps = {
  lead: Lead;
  conversations: Conversation[];
};

function PhoneIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-white/30"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-white/30"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
    </svg>
  );
}

function InterestIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-white/30"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

export function LeadDetailView({ lead, conversations }: LeadDetailViewProps) {
  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        Back to leads
      </Link>

      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        <aside className="lg:col-span-1">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#0066FF]/10 blur-3xl" />

            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {lead.client_name}
                </h1>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusBadgeColor(lead.status)}`}
                >
                  {lead.status}
                </span>
              </div>

              <dl className="mt-6 space-y-4">
                {lead.phone && (
                  <div className="flex items-start gap-3">
                    <PhoneIcon />
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                        Phone
                      </dt>
                      <dd className="mt-0.5 text-sm text-white/80">
                        {lead.phone}
                      </dd>
                    </div>
                  </div>
                )}

                {lead.interest && (
                  <div className="flex items-start gap-3">
                    <InterestIcon />
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                        Interest
                      </dt>
                      <dd className="mt-0.5 text-sm leading-relaxed text-white/80">
                        {lead.interest}
                      </dd>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <CalendarIcon />
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                      Created
                    </dt>
                    <dd className="mt-0.5 text-sm text-white/80">
                      {formatLeadDate(lead.created_at)}
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="mt-6 border-t border-white/5 pt-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Qualificação AI
                </h2>
                <LeadQualificationSummary lead={lead} />
              </div>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-2">
          <ConversationPanel leadId={lead.id} conversations={conversations} />
        </section>
      </div>
    </div>
  );
}
