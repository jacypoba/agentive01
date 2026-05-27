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
      "- If the client is looking for options, say naturally you'll share more soon — one short sentence.",
      "- Example: 'Vou ver o que tenho e mando já.' — NOT 'vou reunir opções para si'.",
    ].join("\n");
  }

  return [
    "---",
    "Property recommendations:",
    "- A real property card will be sent automatically RIGHT AFTER your message (separate WhatsApp message).",
    `- Listing: "${property.title}" in ${property.neighborhood ?? property.city}.`,
    "- Your reply must be ONLY one brief intro sentence — e.g. 'Encontrei uma opção que pode gostar 👇'.",
    "- Do NOT include property details, price, links, emojis for the listing, or formatted card text — the card handles that.",
    "- Do NOT ask a qualification question in the same message — the follow-up after the card will invite feedback.",
    "- NEVER invent listings or details.",
  ].join("\n");
}
