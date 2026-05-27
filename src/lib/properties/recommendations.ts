import type { Property } from "@/types/database";

export function buildPropertyRecommendationDirective(
  property: Property | null
): string {
  if (!property) {
    return [
      "---",
      "Property recommendations:",
      "- No new matching listing to send in this turn (none matched, or all were already shared).",
      "- Do NOT invent or describe fake properties.",
      "- One casual sentence if needed — no forced question.",
      "- Do NOT use corporate phrasing like 'vou reunir opções' or 'obrigado pelo interesse'.",
    ].join("\n");
  }

  return [
    "---",
    "Property recommendations:",
    "- A property card (photo + details + link) will be sent automatically RIGHT AFTER your message.",
    `- Listing: "${property.title}" in ${property.neighborhood ?? property.city}.`,
    "- Your reply = ONE short intro sentence — e.g. 'Tenho uma opção para si 👇'.",
    "- NO question mark. NO repeating their criteria. NO 'quer que eu...'.",
    "- Do NOT include price, specs, links, or card formatting — the card handles that.",
    "- NEVER invent listings or details.",
  ].join("\n");
}
