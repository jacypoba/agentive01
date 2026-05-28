import type { AnalyticsInsight, AnalyticsSnapshot } from "@/lib/analytics/types";

export function generateAnalyticsInsights(
  snapshot: Pick<
    AnalyticsSnapshot,
    | "totals"
    | "languageDistribution"
    | "propertyTypeDistribution"
    | "topCities"
    | "conversionFunnel"
    | "range"
  >
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  if (snapshot.totals.leads === 0) {
    insights.push({
      id: "no-leads",
      tone: "neutral",
      title: "Pipeline warming up",
      body: "No leads captured in this period yet. Once WhatsApp traffic starts, you'll see trends here automatically.",
    });
    return insights;
  }

  if (snapshot.totals.conversionRate >= 35) {
    insights.push({
      id: "strong-conversion",
      tone: "positive",
      title: "Strong qualification rate",
      body: `${snapshot.totals.conversionRate}% of leads reached qualified status — your AI qualification flow is performing well.`,
    });
  } else if (snapshot.totals.conversionRate < 15 && snapshot.totals.leads >= 5) {
    insights.push({
      id: "low-conversion",
      tone: "warning",
      title: "Qualification gap",
      body: "Fewer than 15% of leads are reaching qualified status. Review lead criteria and WhatsApp follow-ups to improve conversion.",
    });
  }

  const topLanguage = snapshot.languageDistribution[0];
  if (topLanguage && topLanguage.name !== "Unknown") {
    insights.push({
      id: "top-language",
      tone: "neutral",
      title: `${topLanguage.name} leads dominate`,
      body: `${topLanguage.percentage}% of leads prefer ${topLanguage.name.toLowerCase()} — keep multilingual replies aligned with this mix.`,
    });
  }

  const topCity = snapshot.topCities[0];
  if (topCity) {
    insights.push({
      id: "top-city",
      tone: "neutral",
      title: `${topCity.name} is your hottest market`,
      body: `${topCity.value} lead${topCity.value === 1 ? "" : "s"} and listings reference ${topCity.name}. Prioritize inventory and visit slots there.`,
    });
  }

  const topType = snapshot.propertyTypeDistribution[0];
  if (topType) {
    insights.push({
      id: "top-type",
      tone: "neutral",
      title: `${topType.name} demand leads`,
      body: `${topType.percentage}% of demand skews toward ${topType.name.toLowerCase()}. Make sure matching stock is visible to the AI.`,
    });
  }

  const confirmedStage = snapshot.conversionFunnel.find(
    (stage) => stage.stage === "confirmed"
  );
  if (
    confirmedStage &&
    confirmedStage.value > 0 &&
    snapshot.totals.visits > 0
  ) {
    insights.push({
      id: "visit-momentum",
      tone: "positive",
      title: "Visit pipeline active",
      body: `${confirmedStage.value} confirmed visit${confirmedStage.value === 1 ? "" : "s"} in ${snapshot.range.label.toLowerCase()} — calendar and WhatsApp confirmations are driving momentum.`,
    });
  }

  if (snapshot.totals.followUpsSent > 0) {
    insights.push({
      id: "follow-ups",
      tone: "positive",
      title: "Follow-ups working",
      body: `${snapshot.totals.followUpsSent} automated follow-up${snapshot.totals.followUpsSent === 1 ? "" : "s"} sent — re-engagement is keeping silent leads warm.`,
    });
  }

  return insights.slice(0, 5);
}
