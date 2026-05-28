import { getLastClientMessageText } from "@/lib/ai/qualification";
import { getLanguageLocale, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import {
  buildNormalizedPropertySearch,
  extractCityFromMessage,
  extractPropertyTypeFromMessage,
  normalizeCity,
  normalizePropertyType,
  normalizeSearchCriteria,
  parseNormalizedBudget,
  type NormalizedPropertySearch,
} from "@/lib/properties/normalize-search";
import type { Conversation, Lead, PropertySearchCriteria } from "@/types/database";

function clientMessagesText(history: Conversation[]): string {
  return history
    .filter((item) => item.sender === "client")
    .map((item) => item.message)
    .join("\n");
}

export function parseBudgetMax(budgetText: string | null | undefined): number | null {
  return parseNormalizedBudget(budgetText);
}

function resolveRawUserInput(
  lead: Lead,
  history: Conversation[],
  preferLatest: boolean
): string {
  const latest = getLastClientMessageText(history)?.trim() ?? "";
  if (preferLatest && latest) return latest;
  return latest || clientMessagesText(history) || lead.interest?.trim() || "";
}

function resolveCitySource(
  lead: Lead,
  history: Conversation[],
  preferLatest: boolean
): string | null {
  if (preferLatest) {
    const latest = getLastClientMessageText(history);
    if (latest) {
      const fromLatest = extractCityFromMessage(latest);
      if (fromLatest) return fromLatest;
    }
    return normalizeCity(lead.preferred_area);
  }

  const fromLead = normalizeCity(lead.preferred_area);
  if (fromLead && lead.preferred_area?.trim()) return fromLead;

  const latest = getLastClientMessageText(history);
  if (latest) {
    const fromLatest = extractCityFromMessage(latest);
    if (fromLatest) return fromLatest;
  }

  return extractCityFromMessage(clientMessagesText(history));
}

function resolvePropertyTypeSource(
  lead: Lead,
  history: Conversation[],
  preferLatest: boolean
): string | null {
  if (preferLatest) {
    const latest = getLastClientMessageText(history);
    if (latest) {
      const fromLatest = extractPropertyTypeFromMessage(latest);
      if (fromLatest) return fromLatest;
    }
    return normalizePropertyType(lead.property_type);
  }

  const fromLead = normalizePropertyType(lead.property_type);
  if (fromLead && lead.property_type?.trim()) return fromLead;

  const latest = getLastClientMessageText(history);
  if (latest) {
    const fromLatest = extractPropertyTypeFromMessage(latest);
    if (fromLatest) return fromLatest;
  }

  return extractPropertyTypeFromMessage(clientMessagesText(history));
}

function resolveBudgetTextSource(
  lead: Lead,
  history: Conversation[],
  preferLatest: boolean
): string | null {
  const fromLead = lead.budget?.trim();
  if (!preferLatest && fromLead) return fromLead;

  const latest = getLastClientMessageText(history);
  if (latest && parseBudgetMax(latest)) return latest;
  if (fromLead) return fromLead;

  return clientMessagesText(history) || null;
}

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
  const rawUserInput = resolveRawUserInput(lead, history, preferLatest);

  const normalized = buildNormalizedPropertySearch({
    rawUserInput,
    city: resolveCitySource(lead, history, preferLatest),
    propertyType: resolvePropertyTypeSource(lead, history, preferLatest),
    budgetText: resolveBudgetTextSource(lead, history, preferLatest),
    relaxed: options?.relaxed,
  });

  return normalized.criteria;
}

export function derivePropertySearchDebug(
  lead: Lead,
  history: Conversation[],
  options?: { relaxed?: boolean; preferLatestMessage?: boolean }
): NormalizedPropertySearch {
  const preferLatest = options?.preferLatestMessage ?? false;
  const rawUserInput = resolveRawUserInput(lead, history, preferLatest);

  return buildNormalizedPropertySearch({
    rawUserInput,
    city: resolveCitySource(lead, history, preferLatest),
    propertyType: resolvePropertyTypeSource(lead, history, preferLatest),
    budgetText: resolveBudgetTextSource(lead, history, preferLatest),
    relaxed: options?.relaxed,
  });
}

/** @deprecated Use derivePropertySearchDebug */
export function derivePropertySearchCriteriaDebug(
  lead: Lead,
  history: Conversation[],
  options?: { relaxed?: boolean; preferLatestMessage?: boolean }
) {
  const debug = derivePropertySearchDebug(lead, history, options);
  return {
    criteria: debug.criteria,
    normalizedCity: debug.normalizedCity,
    normalizedPropertyType: debug.normalizedPropertyType,
    normalizedBudget: debug.normalizedBudget,
    rawUserInput: debug.rawUserInput,
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

export { normalizeSearchCriteria };
