import {
  getIntentStatusColor,
  getIntentStatusLabel,
  getQualificationItems,
  hasQualificationData,
} from "@/lib/leads/qualification-display";
import type { Lead } from "@/types/database";

type LeadQualificationSummaryProps = {
  lead: Lead;
  compact?: boolean;
};

export function LeadQualificationSummary({
  lead,
  compact = false,
}: LeadQualificationSummaryProps) {
  const items = getQualificationItems(lead);

  if (!hasQualificationData(lead)) {
    return (
      <p className="text-xs text-white/30">
        {compact ? "Sem qualificação" : "Qualificação pendente — dados serão extraídos automaticamente das conversas WhatsApp."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lead.intent_status && lead.intent_status !== "unknown" && (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${getIntentStatusColor(lead.intent_status)}`}
        >
          {getIntentStatusLabel(lead.intent_status)}
        </span>
      )}

      {items.length > 0 && (
        <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                {item.label}
              </p>
              <p className="mt-0.5 text-xs text-white/80">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
