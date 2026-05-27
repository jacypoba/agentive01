import { getCatalogCityHint, isCatalogBatch } from "@/lib/properties/property-cards";
import type { Property } from "@/types/database";

export function buildPropertyRecommendationDirective(
  properties: Property[]
): string {
  if (properties.length === 0) {
    return [
      "---",
      "Property recommendations:",
      "- No new matching listing to send in this turn (none matched, or all were already shared).",
      "- Do NOT invent or describe fake properties.",
      "- One casual sentence if needed — no forced question.",
      "- Do NOT use corporate phrasing like 'vou reunir opções' or 'obrigado pelo interesse'.",
    ].join("\n");
  }

  if (isCatalogBatch(properties)) {
    const cityHint = getCatalogCityHint(properties);
    const cityClause = cityHint ? ` in ${cityHint}` : "";
    const titles = properties.map((property) => property.title).join(", ");

    return [
      "---",
      "Property recommendations:",
      `- A catalog of ${properties.length} property cards will be sent RIGHT AFTER your message (photo + details + link for each).`,
      `- Listings${cityClause}: ${titles}.`,
      "- Your reply = ONE short catalog intro only — natural, not robotic.",
      cityHint
        ? `- Example: 'Tenho estas opções em ${cityHint} 👇' or 'Encontrei algumas que encaixam bem${cityClause}.'`
        : "- Example: 'Encontrei algumas que encaixam bem 👇' or 'Tenho estas opções para si.'",
      "- NO question mark. NO repeating their criteria. NO listing details or prices.",
      "- A soft closing may follow the catalog — do NOT preview it in your intro.",
      "- NEVER invent listings or details.",
    ].join("\n");
  }

  const property = properties[0];
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
