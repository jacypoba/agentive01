import {
  classifyPendingOfferResponse,
  shouldAcceptPendingOfferResponse,
} from "@/lib/ai/classify-pending-offer-response";
import {
  extractCityFromMessage,
  extractPropertyTypeFromMessage,
  normalizeCity,
  normalizePropertyType,
  parseNormalizedBudget,
} from "@/lib/properties/normalize-search";
import type { Conversation, Lead, PendingPropertyOffer } from "@/types/database";
import type { DecisionContextUse, DecisionSearchCriteria } from "./types";

const BEDROOM_SPECIFIC_PATTERN =
  /\b(trilocale|bilocale|monolocale|quadri|t[0-4])\b/i;

const NEIGHBORHOOD_PATTERN =
  /\b(zona|quartiere|district|neighborhood|neighbourhood|bairro|regi[aã]o|quartier)\s+([a-zà-ú0-9'\- ]+)/i;

const BUY_RENT_PATTERN =
  /\b(compr(?:ar|a|are|o)|acquist(?:are|o)|buy(?:ing)?|vend(?:a|ita)|purchase|alquil(?:ar|er)|acheter|vendre)\b/i;

const RENT_PATTERN =
  /\b(arrend(?:ar|amento)?|alug(?:ar|ar)?|affitt(?:are|o)|rent(?:ing)?|rental|lease|louer|location|alquiler|alquilar)\b/i;

const REJECTION_PATTERN =
  /\b(n[aã]o|nao|no|non|pas maintenant|not now|not really)\b/i;

export type ResolvedCriteriaShadow = {
  criteria: DecisionSearchCriteria;
  contextUse: DecisionContextUse;
  pendingOfferAccepted: boolean;
  pendingOfferRejected: boolean;
  explicitCityInLatest: string | null;
};

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function extractNeighborhoodFromText(text: string): string | null {
  const match = text.match(NEIGHBORHOOD_PATTERN);
  if (!match?.[2]) return null;
  const neighborhood = match[2].trim().replace(/[,.!?]+$/, "");
  return neighborhood.length > 0 ? neighborhood : null;
}

function resolveBuyRentIntent(text: string): "buy" | "rent" | null {
  const hasRent = RENT_PATTERN.test(text);
  const hasBuy = BUY_RENT_PATTERN.test(text) && !hasRent;
  if (hasRent) return "rent";
  if (hasBuy) return "buy";
  return null;
}

function userExplicitlyMentionedBedroomType(text: string): boolean {
  return BEDROOM_SPECIFIC_PATTERN.test(text);
}

/**
 * Broad property type only — never infer trilocale/T3 from lead memory.
 */
export function extractBroadPropertyType(
  latestMessage: string,
  leadPropertyType: string | null | undefined
): { propertyType: string | null; fromLatest: boolean; fromLead: boolean } {
  const fromLatest = extractPropertyTypeFromMessage(latestMessage);
  if (fromLatest) {
    return { propertyType: fromLatest, fromLatest: true, fromLead: false };
  }

  if (userExplicitlyMentionedBedroomType(latestMessage)) {
    if (/\b(moradia|villa|casa|house|villetta|vivenda|maison)\b/i.test(latestMessage)) {
      return { propertyType: "moradia", fromLatest: true, fromLead: false };
    }
    return { propertyType: "apartamento", fromLatest: true, fromLead: false };
  }

  const leadType = leadPropertyType?.trim();
  if (!leadType || userExplicitlyMentionedBedroomType(leadType)) {
    return { propertyType: null, fromLatest: false, fromLead: false };
  }

  const normalized = normalizePropertyType(leadType);
  if (normalized === "moradia" || normalized === "apartamento") {
    return { propertyType: normalized, fromLatest: false, fromLead: true };
  }

  return { propertyType: null, fromLatest: false, fromLead: false };
}

function shouldCarryPendingOfferContext(
  pendingOffer: PendingPropertyOffer | null,
  explicitCityInLatest: string | null,
  pendingOfferRejected: boolean,
  userOverrodePendingOffer: boolean
): boolean {
  if (!pendingOffer || !explicitCityInLatest) {
    return false;
  }

  if (pendingOfferRejected || userOverrodePendingOffer) {
    return true;
  }

  const offeredCity = normalizeCity(pendingOffer.offeredCity);
  return Boolean(
    offeredCity && fold(offeredCity) !== fold(explicitCityInLatest)
  );
}

function detectOfferCityOverride(
  latestMessage: string,
  offer: PendingPropertyOffer
): { city: string | null; overridden: boolean } {
  const city = extractCityFromMessage(latestMessage);
  if (!city) {
    return { city: null, overridden: false };
  }

  const normalizedCity = normalizeCity(city) ?? city;
  const offeredCity = normalizeCity(offer.offeredCity) ?? offer.offeredCity;

  return {
    city: normalizedCity,
    overridden: fold(normalizedCity) !== fold(offeredCity),
  };
}

function collectPriorClientText(
  history: Conversation[],
  latestMessage: string
): string {
  const clientMessages = history
    .filter((entry) => entry.sender === "client")
    .map((entry) => entry.message.trim())
    .filter(Boolean);

  if (clientMessages.length === 0) {
    return "";
  }

  const last = clientMessages[clientMessages.length - 1];
  if (last && fold(last) === fold(latestMessage.trim())) {
    return clientMessages.slice(0, -1).join("\n");
  }

  return clientMessages.join("\n");
}

function resolveBuyRentIntentFromContext(
  latestMessage: string,
  history: Conversation[]
): "buy" | "rent" | null {
  const fromLatest = resolveBuyRentIntent(latestMessage);
  if (fromLatest) {
    return fromLatest;
  }

  const priorText = collectPriorClientText(history, latestMessage);
  if (!priorText) {
    return null;
  }

  return resolveBuyRentIntent(priorText);
}

function resolvePropertyTypeFromContext(
  latestMessage: string,
  leadPropertyType: string | null | undefined,
  history: Conversation[]
): { propertyType: string | null; fromLatest: boolean; fromLead: boolean } {
  const fromLatestAndLead = extractBroadPropertyType(latestMessage, leadPropertyType);
  if (fromLatestAndLead.propertyType) {
    return fromLatestAndLead;
  }

  const priorText = collectPriorClientText(history, latestMessage);
  if (!priorText) {
    return fromLatestAndLead;
  }

  const fromHistory = extractPropertyTypeFromMessage(priorText);
  if (fromHistory) {
    return { propertyType: fromHistory, fromLatest: false, fromLead: true };
  }

  return fromLatestAndLead;
}

export function resolveCriteriaShadow(
  latestMessage: string,
  lead: Lead,
  pendingOffer: PendingPropertyOffer | null,
  history: Conversation[] = []
): ResolvedCriteriaShadow {
  const contextUse: DecisionContextUse = {
    usedPendingOffer: false,
    userOverrodePendingOffer: false,
    usedLeadMemory: false,
  };

  const explicitCityInLatest =
    normalizeCity(extractCityFromMessage(latestMessage)) ??
    extractCityFromMessage(latestMessage);

  const explicitNeighborhood = extractNeighborhoodFromText(latestMessage);
  const explicitBudget =
    parseNormalizedBudget(latestMessage) ??
    parseNormalizedBudget(lead.budget) ??
    null;
  const propertyTypeResult = resolvePropertyTypeFromContext(
    latestMessage,
    lead.property_type,
    history
  );
  const buyRentIntent = resolveBuyRentIntentFromContext(latestMessage, history);

  let pendingOfferAccepted = false;
  let pendingOfferRejected = false;

  if (pendingOffer) {
    const pendingResponse = classifyPendingOfferResponse(latestMessage, pendingOffer);
    const cityOverride = detectOfferCityOverride(latestMessage, pendingOffer);
    const hasRejection =
      REJECTION_PATTERN.test(latestMessage) &&
      pendingResponse.decision !== "accept";

    if (hasRejection && explicitCityInLatest) {
      pendingOfferRejected = true;
    } else if (shouldAcceptPendingOfferResponse(pendingResponse)) {
      pendingOfferAccepted = true;
    } else if (pendingResponse.decision === "new_search") {
      pendingOfferRejected = true;
    }
  }

  const criteria: DecisionSearchCriteria = {
    city: null,
    neighborhood: null,
    budget: null,
    propertyType: null,
    buyRentIntent,
  };

  if (explicitCityInLatest) {
    criteria.city = explicitCityInLatest;
  } else if (pendingOfferAccepted && pendingOffer && !pendingOfferRejected) {
    criteria.city = normalizeCity(pendingOffer.offeredCity) ?? pendingOffer.offeredCity;
    contextUse.usedPendingOffer = true;
  } else if (!pendingOfferRejected) {
    const fromLead = normalizeCity(lead.preferred_area);
    if (fromLead) {
      criteria.city = fromLead;
      contextUse.usedLeadMemory = true;
    }
  }

  if (explicitCityInLatest && pendingOffer && pendingOfferAccepted) {
    const offeredCity =
      normalizeCity(pendingOffer.offeredCity) ?? pendingOffer.offeredCity;
    if (fold(explicitCityInLatest) !== fold(offeredCity)) {
      contextUse.userOverrodePendingOffer = true;
      contextUse.usedPendingOffer = false;
      criteria.city = explicitCityInLatest;
    }
  }

  if (explicitNeighborhood) {
    criteria.neighborhood = explicitNeighborhood;
  } else if (
    pendingOfferAccepted &&
    pendingOffer &&
    pendingOffer.offeredAreas.length === 1 &&
    !contextUse.userOverrodePendingOffer
  ) {
    criteria.neighborhood = pendingOffer.offeredAreas[0] ?? null;
    contextUse.usedPendingOffer = true;
  }

  if (parseNormalizedBudget(latestMessage) != null) {
    criteria.budget = parseNormalizedBudget(latestMessage);
  } else if (pendingOfferAccepted && pendingOffer?.maxBudget != null) {
    criteria.budget = pendingOffer.maxBudget;
    contextUse.usedPendingOffer = true;
  } else if (parseNormalizedBudget(lead.budget) != null) {
    criteria.budget = parseNormalizedBudget(lead.budget);
    contextUse.usedLeadMemory = true;
  } else {
    criteria.budget = explicitBudget;
  }

  if (propertyTypeResult.fromLatest) {
    criteria.propertyType = propertyTypeResult.propertyType;
  } else if (
    pendingOfferAccepted &&
    pendingOffer?.propertyType &&
    !contextUse.userOverrodePendingOffer
  ) {
    criteria.propertyType =
      normalizePropertyType(pendingOffer.propertyType) ?? pendingOffer.propertyType;
    contextUse.usedPendingOffer = true;
  } else if (propertyTypeResult.fromLead) {
    criteria.propertyType = propertyTypeResult.propertyType;
    contextUse.usedLeadMemory = true;
  }

  const isPivotContext = shouldCarryPendingOfferContext(
    pendingOffer,
    explicitCityInLatest,
    pendingOfferRejected,
    contextUse.userOverrodePendingOffer
  );

  if (!criteria.propertyType?.trim() && isPivotContext && pendingOffer?.propertyType) {
    criteria.propertyType =
      normalizePropertyType(pendingOffer.propertyType) ?? pendingOffer.propertyType;
    contextUse.usedPendingOffer = true;
  }

  if (pendingOfferRejected && explicitCityInLatest) {
    criteria.city = explicitCityInLatest;
    contextUse.userOverrodePendingOffer = true;
    contextUse.usedPendingOffer = false;
  }

  return {
    criteria,
    contextUse,
    pendingOfferAccepted,
    pendingOfferRejected,
    explicitCityInLatest,
  };
}
