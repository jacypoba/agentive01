import { getLastClientMessageText } from "@/lib/ai/qualification";
import type { Conversation, Lead, PropertySearchCriteria } from "@/types/database";

const CITY_PATTERN =
  /\b(?:em|in|a)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\b|\b(lisboa|porto|milano|milan|firenze|florence|roma|rome|cascais|sintra|oeiras|faro|coimbra|braga|paris|london|madrid|barcelona)\b/i;

const PROPERTY_TYPE_PATTERN =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|studio|t[0-4]|house|apartment|flat|villa)\b/i;

function clientMessagesText(history: Conversation[]): string {
  return history
    .filter((item) => item.sender === "client")
    .map((item) => item.message)
    .join("\n");
}

export function parseBudgetMax(budgetText: string | null | undefined): number | null {
  if (!budgetText?.trim()) return null;

  const text = budgetText.toLowerCase().replace(/\s+/g, " ");

  const milhoesMatch = text.match(
    /(\d[\d.,]*)\s*(?:milh[oõ]es|milhão|million|m\b)(?!\w)/i
  );
  if (milhoesMatch) {
    const value = parseLocalizedNumber(milhoesMatch[1]);
    return value != null ? Math.round(value * 1_000_000) : null;
  }

  const milMatch = text.match(/(\d[\d.,]*)\s*(?:mil|k\b)/i);
  if (milMatch) {
    const value = parseLocalizedNumber(milMatch[1]);
    return value != null ? Math.round(value * 1_000) : null;
  }

  const currencyMatch = text.match(/(\d[\d.,]{2,})/);
  if (currencyMatch) {
    const value = parseLocalizedNumber(currencyMatch[1]);
    if (value != null && value >= 10_000) {
      return Math.round(value);
    }
  }

  return null;
}

function parseLocalizedNumber(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  }

  if (cleaned.includes(",") && !cleaned.includes(".")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      const value = Number.parseFloat(`${parts[0]}.${parts[1]}`);
      return Number.isFinite(value) ? value : null;
    }
    const value = Number.parseFloat(cleaned.replace(/,/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  const value = Number.parseFloat(cleaned.replace(/\./g, ""));
  return Number.isFinite(value) ? value : null;
}

function extractCityFromText(text: string): string | null {
  const prepositionMatch = text.match(CITY_PATTERN);
  if (prepositionMatch?.[1]) {
    return prepositionMatch[1].trim();
  }
  if (prepositionMatch?.[2]) {
    return capitalizeWords(prepositionMatch[2]);
  }
  return null;
}

function extractPropertyTypeFromText(text: string): string | null {
  const match = text.match(PROPERTY_TYPE_PATTERN);
  return match?.[1] ? match[1].trim() : null;
}

function capitalizeWords(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function resolveCity(lead: Lead, history: Conversation[]): string | null {
  const fromLead = lead.preferred_area?.trim();
  if (fromLead) return fromLead;

  const latest = getLastClientMessageText(history);
  if (latest) {
    const fromLatest = extractCityFromText(latest);
    if (fromLatest) return fromLatest;
  }

  const fromHistory = extractCityFromText(clientMessagesText(history));
  return fromHistory;
}

function resolvePropertyType(lead: Lead, history: Conversation[]): string | null {
  const fromLead = lead.property_type?.trim();
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

/**
 * Returns search criteria when city and property type are available.
 * Strict mode (default) also requires a parseable budget.
 */
export function derivePropertySearchCriteria(
  lead: Lead,
  history: Conversation[],
  options?: { relaxed?: boolean }
): PropertySearchCriteria | null {
  const city = resolveCity(lead, history);
  const propertyType = resolvePropertyType(lead, history);
  const budgetText = resolveBudgetText(lead, history);
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

export function formatPropertyPrice(price: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}
