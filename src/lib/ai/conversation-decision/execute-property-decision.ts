import { analyzePropertyAvailability } from "@/lib/properties/property-availability";
import {
  buildCityAlternativeFallbackText,
  type CityAlternativeSummary,
} from "@/lib/properties/city-alternatives";
import { pickNoMatchIntroReply } from "@/lib/ai/no-match-reply";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { Conversation, Property, PropertySearchCriteria } from "@/types/database";
import type { SupportedLanguage } from "@/lib/i18n/types";
import { filterPropertiesForDecisionCity } from "./apply-phase-b";
import type { BuiltPropertyDecision } from "./build-property-decision";
import type { ConversationDecision } from "./types";

const QUALIFYING_REPLIES: Record<SupportedLanguage, string[]> = {
  it: [
    "Certo, ti aiuto volentieri. Stai cercando una casa da acquistare o da affittare?",
    "Hai già una zona o un budget in mente?",
  ],
  pt: ["Claro, ajudo sim. Está à procura para comprar ou arrendar?"],
  en: ["Sure, I can help. Are you looking to buy or rent?"],
  es: ["Claro, te ayudo. ¿Buscas comprar o alquilar?"],
  fr: ["Bien sûr, je peux t'aider. Tu cherches à acheter ou à louer?"],
};

const PIVOT_QUALIFYING_REPLIES: Record<string, string> = {
  pt: "Claro — comprar ou arrendar, e que tipo de imóvel procura?",
  it: "Certo — acquistare o affittare, e che tipo di immobile cerca?",
  en: "Sure — are you looking to buy or rent, and what type of property?",
  es: "Claro — ¿comprar o alquilar, y qué tipo de propiedad busca?",
  fr: "D'accord — acheter ou louer, et quel type de bien cherchez-vous?",
};

export type PropertyDecisionV1Execution = {
  propertiesToRecommend: Property[];
  availability: PropertyAvailability;
  criteria: PropertySearchCriteria | null;
  isReshow: boolean;
  freshQueryRan: boolean;
  cityAlternatives: CityAlternativeSummary | null;
  qualifyingReply: string | null;
  decision: ConversationDecision;
  outboundKinds: string[];
};

function pickQualifyingReply(
  language: SupportedLanguage,
  leadId: string,
  reason: string
): string {
  if (reason === "pivot_missing_property_type") {
    return PIVOT_QUALIFYING_REPLIES[language] ?? PIVOT_QUALIFYING_REPLIES.en!;
  }

  const options = QUALIFYING_REPLIES[language] ?? QUALIFYING_REPLIES.en;
  const index =
    Math.abs(
      leadId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
    ) % options.length;
  return options[index]!;
}

function emptyAvailability(criteriaMissing = false): PropertyAvailability {
  return {
    matchingTotal: 0,
    shownCount: 0,
    remainingCount: 0,
    toSend: [],
    remainingAfterSend: 0,
    allShown: false,
    noMatchesInDatabase: false,
    criteriaMissing,
  };
}

export function executePropertyDecision(input: {
  built: BuiltPropertyDecision;
  history: Conversation[];
  leadId: string;
  language: SupportedLanguage;
  isReshow?: boolean;
}): PropertyDecisionV1Execution {
  const { built, history, leadId, language, isReshow = false } = input;
  const { decision, matchingProperties, cityAlternatives, searchCriteria, resolved } =
    built;

  const baseResult = {
    criteria: searchCriteria,
    isReshow,
    freshQueryRan: !isReshow,
    cityAlternatives,
    decision,
  };

  switch (decision.action) {
    case "show_properties": {
      const availability = analyzePropertyAvailability(
        matchingProperties,
        history,
        searchCriteria != null
      );

      let propertiesToRecommend = availability.toSend;
      if (resolved.criteria.city?.trim()) {
        propertiesToRecommend = filterPropertiesForDecisionCity(
          propertiesToRecommend,
          resolved.criteria.city
        );
      }

      return {
        ...baseResult,
        propertiesToRecommend,
        availability: {
          ...availability,
          toSend: propertiesToRecommend,
          matchingTotal: matchingProperties.length,
        },
        qualifyingReply: null,
        outboundKinds:
          propertiesToRecommend.length > 0
            ? ["text", "property_cards"]
            : ["text"],
      };
    }

    case "show_city_alternatives": {
      const availability = analyzePropertyAvailability(
        matchingProperties,
        history,
        searchCriteria != null
      );

      return {
        ...baseResult,
        propertiesToRecommend: [],
        availability: {
          ...availability,
          toSend: [],
          matchingTotal: matchingProperties.length,
          noMatchesInDatabase: true,
        },
        qualifyingReply:
          cityAlternatives && cityAlternatives.availableCities.length > 0
            ? buildCityAlternativeFallbackText(language, cityAlternatives)
            : pickNoMatchIntroReply(language, history, leadId),
        outboundKinds: ["text"],
      };
    }

    case "ask_clarifying_question": {
      return {
        ...baseResult,
        propertiesToRecommend: [],
        availability: emptyAvailability(
          !resolved.criteria.propertyType?.trim()
        ),
        qualifyingReply: pickQualifyingReply(
          language,
          leadId,
          decision.reason
        ),
        outboundKinds: ["text"],
      };
    }

    case "no_match": {
      const availability = analyzePropertyAvailability(
        matchingProperties,
        history,
        searchCriteria != null
      );

      return {
        ...baseResult,
        propertiesToRecommend: [],
        availability: {
          ...availability,
          toSend: [],
          matchingTotal: matchingProperties.length,
          noMatchesInDatabase: true,
        },
        qualifyingReply: pickNoMatchIntroReply(language, history, leadId),
        outboundKinds: ["text"],
      };
    }

    default:
      return {
        ...baseResult,
        propertiesToRecommend: [],
        availability: emptyAvailability(),
        qualifyingReply: null,
        outboundKinds: [],
      };
  }
}

export function logPropertyDecisionV1Applied(input: {
  leadId: string;
  action: ConversationDecision["action"];
  criteria: ConversationDecision["criteria"];
  reason: string;
  propertiesFound: number;
  outboundKinds: string[];
}): void {
  console.log("[Property Decision V1 Applied]", {
    leadId: input.leadId,
    action: input.action,
    criteria: input.criteria,
    reason: input.reason,
    propertiesFound: input.propertiesFound,
    outboundKinds: input.outboundKinds,
  });
}
