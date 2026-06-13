import { getPropertyDirectiveExamples } from "@/lib/ai/property-directive-i18n";
import { isAiQualityV2Enabled } from "@/lib/ai/quality-v2";
import { getCatalogCityHint, isCatalogBatch } from "@/lib/properties/property-cards";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { SupportedLanguage } from "@/lib/i18n/types";
import type { Property } from "@/types/database";

export function buildPropertyRecommendationDirective(
  properties: Property[],
  availability: PropertyAvailability,
  language: SupportedLanguage = "pt"
): string {
  const examples = getPropertyDirectiveExamples(language);

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
      const exhaustedLine = isAiQualityV2Enabled()
        ? `- Reply: "${examples.allShownReply}"`
        : '- Reply: "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso."';

      return [
        "---",
        "Property recommendations:",
        "- All matching listings were already shared. Zero remaining in database.",
        "- NO cards will be sent.",
        exhaustedLine,
        '- Do NOT say "não tenho mais opções" or "não há mais imóveis" — use the line above.',
      ].join("\n");
    }

    if (availability.noMatchesInDatabase) {
      const noMatchHint = isAiQualityV2Enabled()
        ? `- Say naturally that nothing matched right now — e.g. "${examples.noMatchReply}"`
        : '- Say naturally that nothing matched right now — one short sentence.';

      return [
        "---",
        "Property recommendations:",
        "- Database returned zero matches for this profile.",
        "- NO cards will be sent.",
        '- Do NOT say "não tenho mais opções".',
        noMatchHint,
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
      const introExample = isAiQualityV2Enabled()
        ? `- ONE short intro — e.g. '${examples.reshowCatalogIntro}'.`
        : "- ONE short intro — e.g. 'Estas foram as opções 👇'.";

      return [
        "---",
        "Property recommendations:",
        `- Re-sending ${properties.length} previously shown listing(s): ${titles}.`,
        introExample,
        "- NEVER say you already showed them without re-sending.",
      ].join("\n");
    }

    const cityHint = getCatalogCityHint(properties);
    const cityClause = cityHint ? ` in ${cityHint}` : "";
    const titles = properties.map((property) => property.title).join(", ");
    const [introA, introB] = examples.catalogIntroOptions;
    const catalogIntroExample = isAiQualityV2Enabled()
      ? `- Your reply = ONE short intro only — e.g. '${introA}' or '${introB}'`
      : "- Your reply = ONE short intro only — e.g. 'Tenho mais algumas 👇' or 'Estas também encaixam.'";

    return [
      "---",
      "Property recommendations:",
      `- Sending ${properties.length} more listing(s) from database RIGHT AFTER your message.`,
      `- Listings${cityClause}: ${titles}.`,
      catalogIntroExample,
      "- NO question mark. NO saying there are no more options.",
      "- NEVER invent listings or details.",
    ].join("\n");
  }

  const property = properties[0];
  const singleIntroExample = isAiQualityV2Enabled()
    ? `- Your reply = ONE short intro sentence — e.g. '${examples.singleIntro}'.`
    : "- Your reply = ONE short intro sentence — e.g. 'Tenho mais uma opção 👇'.";

  return [
    "---",
    "Property recommendations:",
    "- A property card will be sent automatically RIGHT AFTER your message.",
    `- Listing: "${property.title}" in ${property.neighborhood ?? property.city}.`,
    singleIntroExample,
    "- NO question mark. NO saying there are no more options.",
    "- NEVER invent listings or details.",
  ].join("\n");
}
