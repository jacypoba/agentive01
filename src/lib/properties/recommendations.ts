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
      "- If the client is looking for options, one casual sentence — e.g. 'Deixa-me ver o que tenho.'",
      "- Do NOT use corporate phrasing like 'vou reunir opções' or 'obrigado pelo interesse'.",
    ].join("\n");
  }

  return [
    "---",
    "Property recommendations:",
    "- A property card (photo + details + link) will be sent automatically RIGHT AFTER your message.",
    `- Listing: "${property.title}" in ${property.neighborhood ?? property.city}.`,
    "- Your reply = ONE short, natural intro sentence only — e.g. 'Tenho uma opção que pode fazer sentido 👇'.",
    "- Do NOT include price, specs, links, or card formatting — the card handles that.",
    "- Do NOT ask a question in the intro — a natural follow-up comes after the card.",
    "- NEVER invent listings or details.",
  ].join("\n");
}
