import { getPropertyDirectiveExamples } from "@/lib/ai/property-directive-i18n";
import { isAiQualityV2Enabled } from "@/lib/ai/quality-v2";
import type { SupportedLanguage } from "@/lib/i18n/types";
import type { Conversation, Property } from "@/types/database";
import {
  selectPropertiesForCatalog,
  wasPropertyAlreadySent,
} from "@/lib/properties/property-cards";

export type PropertyAvailability = {
  matchingTotal: number;
  shownCount: number;
  remainingCount: number;
  toSend: Property[];
  remainingAfterSend: number;
  /** All DB matches for this profile were already shared. */
  allShown: boolean;
  /** Query ran but returned zero properties. */
  noMatchesInDatabase: boolean;
  /** Could not build search criteria from CRM/history. */
  criteriaMissing: boolean;
  /** Re-sending a previously shown batch (not new listings). */
  isReshow?: boolean;
};

export function analyzePropertyAvailability(
  matchingProperties: Property[],
  history: Conversation[],
  criteriaAvailable: boolean
): PropertyAvailability {
  const unsent = matchingProperties.filter(
    (property) => !wasPropertyAlreadySent(history, property)
  );
  const toSend = selectPropertiesForCatalog(matchingProperties, history);

  return {
    matchingTotal: matchingProperties.length,
    shownCount: matchingProperties.length - unsent.length,
    remainingCount: unsent.length,
    toSend,
    remainingAfterSend: Math.max(0, unsent.length - toSend.length),
    allShown: matchingProperties.length > 0 && unsent.length === 0,
    noMatchesInDatabase: criteriaAvailable && matchingProperties.length === 0,
    criteriaMissing: !criteriaAvailable,
    isReshow: false,
  };
}

export function buildReshowAvailability(
  reshownProperties: Property[],
  matchingProperties: Property[],
  history: Conversation[],
  criteriaAvailable: boolean
): PropertyAvailability {
  const unsent = matchingProperties.filter(
    (property) => !wasPropertyAlreadySent(history, property)
  );

  return {
    matchingTotal: matchingProperties.length,
    shownCount: matchingProperties.length - unsent.length,
    remainingCount: unsent.length,
    toSend: reshownProperties,
    remainingAfterSend: unsent.length,
    allShown: false,
    noMatchesInDatabase: false,
    criteriaMissing: !criteriaAvailable,
    isReshow: true,
  };
}

export function buildAvailabilityDirective(
  availability: PropertyAvailability,
  clientAskedForMore: boolean,
  language: SupportedLanguage = "pt"
): string {
  const examples = getPropertyDirectiveExamples(language);

  const lines = [
    "---",
    "Property availability (from live database query — authoritative):",
    `- Matching listings in database: ${availability.matchingTotal}`,
    `- Already shared with client: ${availability.shownCount}`,
    `- Remaining unsent matches: ${availability.remainingCount}`,
    `- Sending this turn: ${availability.toSend.length}`,
    `- Still available after this send: ${availability.remainingAfterSend}`,
  ];

  if (availability.criteriaMissing) {
    lines.push(
      "- Search criteria incomplete — could not query listings.",
      "- Do NOT say there are no more properties or no options.",
      "- Ask ONE missing detail (city, type, or budget) if needed — or acknowledge you're checking once criteria is clear."
    );
    return lines.join("\n");
  }

  if (availability.toSend.length > 0) {
    if (availability.isReshow) {
      const reshowExample = isAiQualityV2Enabled()
        ? `- Write ONE brief line only — e.g. '${examples.reshowCatalogIntro}'.`
        : "- Write ONE brief line only — e.g. 'Claro — volto a enviar 👇'.";

      lines.push(
        "- Previously shown listings WILL be re-sent after your message.",
        reshowExample,
        "- NEVER say 'já mostrei', 'já enviei', or 'já partilhei' without the cards going out.",
        "- Do NOT ask a question."
      );
      return lines.join("\n");
    }

    lines.push(
      "- New property card(s) WILL be sent after your message.",
      "- Write a brief intro only — the system handles the listings.",
      "- Do NOT say there are no more options — more exist and are being sent."
    );
    if (availability.remainingAfterSend > 0) {
      const moreExample = isAiQualityV2Enabled()
        ? `- You may mention more exist ONLY if accurate — e.g. '${examples.hasMoreInProfile}' — but do not ask a question.`
        : "- You may mention more exist ONLY if accurate — e.g. 'Tenho mais no mesmo perfil' — but do not ask a question.";

      lines.push(
        `- After this batch, ${availability.remainingAfterSend} more match(es) remain in the database (not sent yet).`,
        moreExample
      );
    }
    return lines.join("\n");
  }

  if (availability.allShown) {
    const exhaustedLine = isAiQualityV2Enabled()
      ? `- Say naturally: "${examples.allShownReply}"`
      : clientAskedForMore
        ? '- Say naturally: "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso."'
        : "- One short natural line if needed — acknowledge these are the best matches for now.";

    lines.push(
      "- All matching listings for this profile were already shared. Zero remaining in database.",
      "- NO property cards will be sent this turn.",
      exhaustedLine,
      '- NEVER say "não tenho imóveis", "não há imóveis disponíveis", or imply the market is empty.',
      '- BANNED unless remaining is truly zero (it is): promising to send more listings now.'
    );
    return lines.join("\n");
  }

  if (availability.noMatchesInDatabase) {
    const noMatchExample = isAiQualityV2Enabled()
      ? `- Say naturally that nothing matched this profile right now — e.g. "${examples.noMatchReply}"`
      : '- Say naturally that nothing matched this profile right now — e.g. "Não encontrei imóveis neste perfil de momento."';

    lines.push(
      "- Database query returned zero matches for this profile.",
      "- NO property cards will be sent.",
      "- Do NOT say 'não tenho mais opções' (implies options existed before).",
      noMatchExample
    );
    return lines.join("\n");
  }

  return lines.join("\n");
}
