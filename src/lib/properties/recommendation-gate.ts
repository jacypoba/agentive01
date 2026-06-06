import { clientAskedToSeeOptions } from "@/lib/ai/qualification";
import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import type { SupportedLanguage } from "@/lib/i18n/types";
import {
  extractCityFromMessage,
  normalizeCity,
  parseNormalizedBudget,
  type NormalizedPropertySearch,
} from "@/lib/properties/normalize-search";
import type { Conversation, Lead } from "@/types/database";

export type PropertyRecommendationGateReason =
  | "broad_search_needs_qualification"
  | "enough_criteria"
  | "explicit_show_request"
  | "not_applicable";

export type PropertyRecommendationGateCriteria = {
  city: string | null;
  propertyType: string | null;
  budget: number | null;
  neighborhood: string | null;
  buyRentIntent: "buy" | "rent" | null;
  explicitShowRequest: boolean;
};

export type PropertyRecommendationGateResult = {
  shouldSendRecommendations: boolean;
  reason: PropertyRecommendationGateReason;
  criteria: PropertyRecommendationGateCriteria;
  qualifyingReply: string | null;
};

const NEIGHBORHOOD_PATTERN =
  /\b(zona|quartiere|district|neighborhood|neighbourhood|bairro|regi[aã]o|quartier)\s+([a-zà-ú0-9'\- ]+)/i;

const BUY_RENT_PATTERN =
  /\b(compr(?:ar|a|are|o)|acquist(?:are|o)|buy(?:ing)?|vend(?:a|ita)|purchase|alquil(?:ar|er)|comprar|acheter|louer|vendre)\b/i;

const RENT_PATTERN =
  /\b(arrend(?:ar|amento)?|alug(?:ar|ar)?|affitt(?:are|o)|rent(?:ing)?|rental|lease|louer|location|alquiler|alquilar)\b/i;

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

function clientMessagesText(history: Conversation[]): string {
  return history
    .filter((item) => item.sender === "client")
    .map((item) => item.message)
    .join("\n");
}

function extractNeighborhoodFromText(text: string): string | null {
  const match = text.match(NEIGHBORHOOD_PATTERN);
  if (!match?.[2]) return null;
  const neighborhood = match[2].trim().replace(/[,.!?]+$/, "");
  return neighborhood.length > 0 ? neighborhood : null;
}

function resolveNeighborhood(
  history: Conversation[],
  lead: Lead,
  city: string | null
): string | null {
  const clientText = clientMessagesText(history);
  const fromMessage = extractNeighborhoodFromText(clientText);
  if (fromMessage) return fromMessage;

  const preferredArea = lead.preferred_area?.trim();
  if (!preferredArea) return null;

  const normalizedPreferred = normalizeCity(preferredArea);
  const normalizedCity = city ? normalizeCity(city) : null;
  if (
    normalizedPreferred &&
    normalizedCity &&
    fold(normalizedPreferred) === fold(normalizedCity)
  ) {
    return null;
  }

  return preferredArea;
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function resolveBudget(
  history: Conversation[],
  lead: Lead,
  searchDebug: NormalizedPropertySearch
): number | null {
  if (searchDebug.normalizedBudget != null) {
    return searchDebug.normalizedBudget;
  }

  const clientText = clientMessagesText(history);
  return (
    parseNormalizedBudget(clientText) ??
    parseNormalizedBudget(lead.budget) ??
    null
  );
}

function resolveBuyRentIntent(text: string): "buy" | "rent" | null {
  const hasRent = RENT_PATTERN.test(text);
  const hasBuy = BUY_RENT_PATTERN.test(text) && !hasRent;
  if (hasRent) return "rent";
  if (hasBuy) return "buy";
  return null;
}

function resolveCity(
  searchDebug: NormalizedPropertySearch,
  history: Conversation[]
): string | null {
  return (
    searchDebug.normalizedCity ??
    extractCityFromMessage(clientMessagesText(history))
  );
}

function pickQualifyingReply(
  language: SupportedLanguage,
  leadId: string
): string {
  const options = QUALIFYING_REPLIES[language] ?? QUALIFYING_REPLIES.en;
  const index =
    Math.abs(
      leadId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
    ) % options.length;
  return options[index]!;
}

export function buildPropertyRecommendationGateCriteria(
  lead: Lead,
  history: Conversation[],
  searchDebug: NormalizedPropertySearch
): PropertyRecommendationGateCriteria {
  const clientText = clientMessagesText(history);
  const city = resolveCity(searchDebug, history);

  return {
    city,
    propertyType: searchDebug.normalizedPropertyType,
    budget: resolveBudget(history, lead, searchDebug),
    neighborhood: resolveNeighborhood(history, lead, city),
    buyRentIntent: resolveBuyRentIntent(clientText),
    explicitShowRequest: clientAskedToSeeOptions(history),
  };
}

export function evaluatePropertyRecommendationGate(input: {
  leadId: string;
  lead: Lead;
  history: Conversation[];
  searchDebug: NormalizedPropertySearch;
  classified: ClassifiedIntent;
  language: SupportedLanguage;
  hasPropertiesToSend: boolean;
  isReshow: boolean;
}): PropertyRecommendationGateResult {
  const criteria = buildPropertyRecommendationGateCriteria(
    input.lead,
    input.history,
    input.searchDebug
  );

  const notApplicable = (
    shouldSendRecommendations: boolean
  ): PropertyRecommendationGateResult => ({
    shouldSendRecommendations,
    reason: "not_applicable",
    criteria,
    qualifyingReply: null,
  });

  if (
    input.isReshow ||
    input.classified.intent !== "property_search" ||
    !input.hasPropertiesToSend
  ) {
    return notApplicable(true);
  }

  if (criteria.explicitShowRequest) {
    return {
      shouldSendRecommendations: true,
      reason: "explicit_show_request",
      criteria,
      qualifyingReply: null,
    };
  }

  if (criteria.budget != null || criteria.neighborhood) {
    return {
      shouldSendRecommendations: true,
      reason: "enough_criteria",
      criteria,
      qualifyingReply: null,
    };
  }

  if (criteria.city) {
    return {
      shouldSendRecommendations: false,
      reason: "broad_search_needs_qualification",
      criteria,
      qualifyingReply: pickQualifyingReply(input.language, input.leadId),
    };
  }

  return {
    shouldSendRecommendations: true,
    reason: "enough_criteria",
    criteria,
    qualifyingReply: null,
  };
}

export function logPropertyRecommendationGate(
  leadId: string,
  gate: PropertyRecommendationGateResult
): void {
  console.log("[Property recommendation gate]", {
    leadId,
    shouldSendRecommendations: gate.shouldSendRecommendations,
    reason: gate.reason,
    criteria: gate.criteria,
  });
}
