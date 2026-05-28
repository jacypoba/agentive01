import { getLastClientMessageText } from "@/lib/ai/qualification";
import { getLanguageLocale, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import {
  normalizeCity,
  normalizePropertyType,
  parseNormalizedBudget,
} from "@/lib/properties/normalize-search";
import type { Conversation, Lead, PropertySearchCriteria } from "@/types/database";

const CITY_PATTERN =
  /\b(?:em|in|en|a)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\b|\b(lisboa|porto|milano|milan|milão|milao|firenze|florence|roma|rome|cascais|sintra|oeiras|faro|coimbra|braga|paris|london|madrid|barcelona)\b/i;

const PROPERTY_TYPE_PATTERN =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|estudio|studio|t[0-4]|house|apartment|appartamento|flat|villa|home|casa|villetta|vivienda)\b/i;

function clientMessagesText(history: Conversation[]): string {
  return history
    .filter((item) => item.sender === "client")
    .map((item) => item.message)
    .join("\n");
}

export function parseBudgetMax(budgetText: string | null | undefined): number | null {
  return parseNormalizedBudget(budgetText);
}

function extractCityFromText(text: string): string | null {
  const prepositionMatch = text.match(CITY_PATTERN);
  if (prepositionMatch?.[1]) {
    return normalizeCity(prepositionMatch[1].trim());
  }
  if (prepositionMatch?.[2]) {
    return normalizeCity(prepositionMatch[2]);
  }
  return null;
}

function extractPropertyTypeFromText(text: string): string | null {
  const match = text.match(PROPERTY_TYPE_PATTERN);
  return match?.[1] ? normalizePropertyType(match[1].trim()) : null;
}

function resolveCity(lead: Lead, history: Conversation[]): string | null {
  const fromLead = normalizeCity(lead.preferred_area);
  if (fromLead) return fromLead;

  const latest = getLastClientMessageText(history);
  if (latest) {
    const fromLatest = extractCityFromText(latest);
    if (fromLatest) return fromLatest;
  }

  return extractCityFromText(clientMessagesText(history));
}

function resolvePropertyType(lead: Lead, history: Conversation[]): string | null {
  const fromLead = normalizePropertyType(lead.property_type);
  if (fromLead) return fromLead;

  const latest = getLastClientMessageText(history);
  if (latest) {
    const fromLatest = extractPropertyTypeFromText(latest);
    if (fromLatest) return fromLatest;
  }

  return extractPropertyTypeFromText(clientMessagesText(history));
}

function resolveBudgetText(lead: Lead, history: Conversation[]): string | null {
  const fromLead = lead.budget?.trim();
  if (fromLead) return fromLead;

  const latest = getLastClientMessageText(history);
  if (latest && parseBudgetMax(latest)) {
    return latest;
  }

  return clientMessagesText(history) || null;
}

function extractCityFromLatest(history: Conversation[]): string | null {
  const latest = getLastClientMessageText(history);
  if (!latest) return null;
  return extractCityFromText(latest);
}

function extractTypeFromLatest(history: Conversation[]): string | null {
  const latest = getLastClientMessageText(history);
  if (!latest) return null;
  return extractPropertyTypeFromText(latest);
}

function resolveLatestBudgetText(history: Conversation[]): string | null {
  const latest = getLastClientMessageText(history);
  if (!latest) return null;
  return parseBudgetMax(latest) ? latest : null;
}

export type DerivedSearchCriteria = PropertySearchCriteria & {
  normalizedCity: string;
  normalizedPropertyType: string;
  normalizedBudget: number | null;
};

/**
 * Returns search criteria when city and property type are available.
 * Strict mode (default) also requires a parseable budget.
 */
export function derivePropertySearchCriteria(
  lead: Lead,
  history: Conversation[],
  options?: { relaxed?: boolean; preferLatestMessage?: boolean }
): PropertySearchCriteria | null {
  const preferLatest = options?.preferLatestMessage ?? false;
  const city = preferLatest
    ? normalizeCity(extractCityFromLatest(history) ?? lead.preferred_area) ??
      normalizeCity(lead.preferred_area)
    : resolveCity(lead, history);
  const propertyType = preferLatest
    ? normalizePropertyType(extractTypeFromLatest(history) ?? lead.property_type) ??
      normalizePropertyType(lead.property_type)
    : resolvePropertyType(lead, history);
  const budgetText = preferLatest
    ? resolveLatestBudgetText(history) ?? lead.budget?.trim() ?? null
    : resolveBudgetText(lead, history);
  const maxBudget = parseBudgetMax(budgetText);

  if (options?.relaxed) {
    if (!city || !propertyType) {
      return null;
    }
    return {
      city,
      propertyType,
      maxBudget: maxBudget ?? undefined,
    };
  }

  if (!city || !propertyType || maxBudget == null) {
    return null;
  }

  return {
    city,
    propertyType,
    maxBudget,
  };
}

export function derivePropertySearchCriteriaDebug(
  lead: Lead,
  history: Conversation[],
  options?: { relaxed?: boolean; preferLatestMessage?: boolean }
): {
  criteria: PropertySearchCriteria | null;
  normalizedCity: string | null;
  normalizedPropertyType: string | null;
  normalizedBudget: number | null;
} {
  const criteria = derivePropertySearchCriteria(lead, history, options);
  const budgetText = getLastClientMessageText(history) ?? lead.budget ?? null;

  return {
    criteria,
    normalizedCity: criteria?.city ?? normalizeCity(lead.preferred_area),
    normalizedPropertyType:
      criteria?.propertyType ?? normalizePropertyType(lead.property_type),
    normalizedBudget:
      criteria?.maxBudget ?? parseBudgetMax(budgetText) ?? parseBudgetMax(lead.budget),
  };
}

export function formatPropertyPrice(price: number): string {
  return formatPropertyPriceForLanguage(price, "pt");
}

export function formatPropertyPriceForLanguage(
  price: number,
  language: SupportedLanguage = "pt"
): string {
  const locale = getLanguageLocale(normalizeLanguage(language));
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}
