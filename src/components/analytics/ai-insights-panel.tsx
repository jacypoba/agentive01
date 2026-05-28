import type { AnalyticsInsight } from "@/lib/analytics/types";

type AiInsightsPanelProps = {
  insights: AnalyticsInsight[];
};

const toneStyles: Record<
  AnalyticsInsight["tone"],
  { border: string; badge: string; badgeText: string }
> = {
  positive: {
    border: "border-emerald-500/20 bg-emerald-500/[0.04]",
    badge: "bg-emerald-500/15 text-emerald-200",
    badgeText: "Opportunity",
  },
  neutral: {
    border: "border-[#0066FF]/20 bg-[#0066FF]/[0.04]",
    badge: "bg-[#0066FF]/15 text-[#00D4FF]",
    badgeText: "Insight",
  },
  warning: {
    border: "border-amber-500/20 bg-amber-500/[0.04]",
    badge: "bg-amber-500/15 text-amber-200",
    badgeText: "Attention",
  },
};

export function AiInsightsPanel({ insights }: AiInsightsPanelProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#00D4FF]">
            AI insights
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            What your pipeline is telling you
          </h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/50">
          Auto-generated
        </span>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
          <p className="text-sm text-white/45">
            Insights will appear once enough CRM activity is captured.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => {
            const styles = toneStyles[insight.tone];
            return (
              <article
                key={insight.id}
                className={`rounded-xl border p-4 ${styles.border}`}
              >
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles.badge}`}
                >
                  {styles.badgeText}
                </span>
                <h4 className="mt-2 text-sm font-semibold text-white">
                  {insight.title}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  {insight.body}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
