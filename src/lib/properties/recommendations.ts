import { getCatalogCityHint, isCatalogBatch } from "@/lib/properties/property-cards";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { Property } from "@/types/database";

export function buildPropertyRecommendationDirective(
  properties: Property[],
  availability: PropertyAvailability
): string {
  if (properties.length === 0) {
    if (availability.isReshow) {
      return [
        "---",
        "Property recommendations:",
        "- Re-sending previously shown listings after your message.",
        "- Brief intro only — cards follow automatically.",
      ].join("\n");
    }

    if (availability.allShown) {
      return [
        "---",
        "Property recommendations:",
        "- All matching listings were already shared. Zero remaining in database.",
        "- NO cards will be sent.",
        '- Reply: "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso."',
        '- Do NOT say "não tenho mais opções" or "não há mais imóveis" — use the line above.',
      ].join("\n");
    }

    if (availability.noMatchesInDatabase) {
      return [
        "---",
        "Property recommendations:",
        "- Database returned zero matches for this profile.",
        "- NO cards will be sent.",
        '- Do NOT say "não tenho mais opções".',
        '- Say naturally that nothing matched right now — one short sentence.',
      ].join("\n");
    }

    return [
      "---",
      "Property recommendations:",
      "- No listings to send this turn.",
      "- Do NOT invent properties or claim the database is empty unless confirmed above.",
      "- One casual sentence if needed — no forced question.",
    ].join("\n");
  }

  if (isCatalogBatch(properties)) {
    if (availability.isReshow) {
      const titles = properties.map((property) => property.title).join(", ");
      return [
        "---",
        "Property recommendations:",
        `- Re-sending ${properties.length} previously shown listing(s): ${titles}.`,
        "- ONE short intro — e.g. 'Estas foram as opções 👇'.",
        "- NEVER say you already showed them without re-sending.",
      ].join("\n");
    }

    const cityHint = getCatalogCityHint(properties);
    const cityClause = cityHint ? ` in ${cityHint}` : "";
    const titles = properties.map((property) => property.title).join(", ");

    return [
      "---",
      "Property recommendations:",
      `- Sending ${properties.length} more listing(s) from database RIGHT AFTER your message.`,
      `- Listings${cityClause}: ${titles}.`,
      "- Your reply = ONE short intro only — e.g. 'Tenho mais algumas 👇' or 'Estas também encaixam.'",
      "- NO question mark. NO saying there are no more options.",
      "- NEVER invent listings or details.",
    ].join("\n");
  }

  const property = properties[0];
  return [
    "---",
    "Property recommendations:",
    "- A property card will be sent automatically RIGHT AFTER your message.",
    `- Listing: "${property.title}" in ${property.neighborhood ?? property.city}.`,
    "- Your reply = ONE short intro sentence — e.g. 'Tenho mais uma opção 👇'.",
    "- NO question mark. NO saying there are no more options.",
    "- NEVER invent listings or details.",
  ].join("\n");
}
