import { updateLeadQualification } from "@/lib/data/leads";
import { searchMatchingProperties } from "@/lib/data/properties";
import {
  normalizeSearchCriteria,
  parseNormalizedBudget,
} from "@/lib/properties/normalize-search";
import type { CityAlternativeSummary } from "@/lib/properties/city-alternatives";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Lead,
  PendingPropertyOffer,
  Property,
  PropertySearchCriteria,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export type {
  PendingPropertyOffer,
  PendingPropertyOfferStatus,
} from "@/types/database";

const MORE_OPTIONS_PATTERN =
  /\b(mostra outras|outras opções|outras opcões|outras opcoes|tem mais|tens mais|há mais|ha mais|mais opções|mais opcões|more options|altre opzioni|más opciones)\b/i;

const AFFIRMATIVE_ONLY =
  /^(sim|sì|si|yes|yeah|yep|oui|ok|okay|sí|ja|oui[\s,!.👌🙂]*)$/i;

const ACCEPTANCE_PHRASE_PATTERN =
  /\b(mostra-me|mostrami|fammi vedere|fami vedere|show me|send them|envia|muestrame|muéstrame|quiero ver|quero ver|je veux voir|montre-moi|montre moi)\b/i;

const PROPERTY_SEARCH_PATTERN =
  /\b(procuro|procurar|procura|quero|preciso|interess(?:a|o)|busco|pesquiso|looking for|searching for|cerco|cercare|voglio|quiero|buscar)\b/i;

const PROPERTY_TYPE_IN_MESSAGE =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|estudio|studio|house|apartment|appartamento|flat|villa|home|casa|villetta|vivienda|t[0-4])\b/i;

const CITY_OR_BUDGET_SIGNAL =
  /\b(em\s+[a-zà-ú]|in\s+[a-z]|en\s+[a-z]|a\s+[a-z]|lisboa|porto|milano|milan|milão|firenze|florence|roma|cascais|sintra|oeiras|faro|coimbra|braga|até|fino a|hasta|orçamento|budget|presupuesto|€|\d[\d.,\s]*(mil|mila|k|milhões?))\b/i;

function isNewPropertySearchMessage(text: string): boolean {
  if (!text.trim()) return false;

  const hasSearchVerb = PROPERTY_SEARCH_PATTERN.test(text);
  const hasType = PROPERTY_TYPE_IN_MESSAGE.test(text);
  const hasLocationOrBudget = CITY_OR_BUDGET_SIGNAL.test(text);

  if (hasSearchVerb && (hasType || hasLocationOrBudget)) {
    return true;
  }

  return hasType && hasLocationOrBudget;
}

export function parsePendingPropertyOffer(lead: Lead): PendingPropertyOffer | null {
  const raw = lead.pending_property_offer;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const offeredCity =
    typeof record.offeredCity === "string" ? record.offeredCity.trim() : "";
  const offeredAreas = Array.isArray(record.offeredAreas)
    ? record.offeredAreas.filter((item): item is string => typeof item === "string")
    : [];
  const status = record.status === "completed" ? "completed" : "pending";
  const source = record.source === "city_fallback" ? "city_fallback" : null;
  const createdAt =
    typeof record.createdAt === "string" ? record.createdAt : new Date(0).toISOString();

  if (!offeredCity || !source) {
    return null;
  }

  return {
    offeredCity,
    offeredAreas,
    source,
    createdAt,
    status,
    requestedCity:
      typeof record.requestedCity === "string" ? record.requestedCity : undefined,
    propertyType:
      typeof record.propertyType === "string" ? record.propertyType : undefined,
    maxBudget:
      typeof record.maxBudget === "number"
        ? record.maxBudget
        : record.maxBudget === null
          ? null
          : undefined,
  };
}

export function getActivePendingPropertyOffer(lead: Lead): PendingPropertyOffer | null {
  const offer = parsePendingPropertyOffer(lead);
  if (!offer || offer.status !== "pending") {
    return null;
  }
  return offer;
}

export function isPendingOfferAcceptanceMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) {
    return false;
  }

  if (MORE_OPTIONS_PATTERN.test(trimmed)) {
    return false;
  }

  if (isNewPropertySearchMessage(trimmed)) {
    return false;
  }

  if (AFFIRMATIVE_ONLY.test(trimmed)) {
    return true;
  }

  return ACCEPTANCE_PHRASE_PATTERN.test(trimmed);
}

export function buildPendingOfferFromCityAlternative(
  summary: CityAlternativeSummary,
  criteria: PropertySearchCriteria
): PendingPropertyOffer {
  return {
    offeredCity: summary.primaryCity,
    offeredAreas:
      summary.primaryAreas.length > 0
        ? summary.primaryAreas
        : summary.availableAreas.slice(0, 3),
    source: "city_fallback",
    createdAt: new Date().toISOString(),
    status: "pending",
    requestedCity: summary.requestedCity,
    propertyType: criteria.propertyType,
    maxBudget: criteria.maxBudget ?? null,
  };
}

export function deriveSearchCriteriaFromPendingOffer(
  offer: PendingPropertyOffer,
  lead: Lead
): PropertySearchCriteria | null {
  const propertyType =
    offer.propertyType ??
    lead.property_type?.trim() ??
    null;

  if (!offer.offeredCity?.trim() || !propertyType) {
    return null;
  }

  const maxBudget =
    offer.maxBudget ??
    parseNormalizedBudget(lead.budget) ??
    undefined;

  const neighborhood =
    offer.offeredAreas.length === 1 ? offer.offeredAreas[0]! : undefined;

  return normalizeSearchCriteria({
    city: offer.offeredCity,
    propertyType,
    maxBudget,
    neighborhood,
  });
}

function filterByOfferedAreas(
  properties: Property[],
  offeredAreas: string[]
): Property[] {
  if (offeredAreas.length <= 1) {
    return properties;
  }

  return properties.filter((property) => {
    const neighborhood = property.neighborhood?.trim() ?? "";
    if (!neighborhood) return false;
    return offeredAreas.some((area) =>
      neighborhood.toLowerCase().includes(area.toLowerCase()) ||
      area.toLowerCase().includes(neighborhood.toLowerCase())
    );
  });
}

export async function findPropertiesForPendingOffer(
  supabase: Client,
  lead: Lead,
  offer: PendingPropertyOffer,
  limit = 20
): Promise<{ properties: Property[]; criteria: PropertySearchCriteria | null }> {
  const workspaceId = lead.workspace_id;
  if (!workspaceId) {
    return { properties: [], criteria: null };
  }

  const criteria = deriveSearchCriteriaFromPendingOffer(offer, lead);
  if (!criteria) {
    return { properties: [], criteria: null };
  }

  let properties = await searchMatchingProperties(
    supabase,
    workspaceId,
    criteria,
    limit
  );

  properties = filterByOfferedAreas(properties, offer.offeredAreas);

  return { properties, criteria };
}

export async function savePendingPropertyOffer(
  supabase: Client,
  workspaceId: string,
  leadId: string,
  offer: PendingPropertyOffer
): Promise<Lead> {
  return updateLeadQualification(supabase, workspaceId, leadId, {
    pending_property_offer: offer,
  });
}

export async function completePendingPropertyOffer(
  supabase: Client,
  workspaceId: string,
  leadId: string,
  offer: PendingPropertyOffer
): Promise<Lead> {
  return updateLeadQualification(supabase, workspaceId, leadId, {
    pending_property_offer: {
      ...offer,
      status: "completed",
    },
  });
}

export function logPendingOfferCreated(
  leadId: string,
  offer: PendingPropertyOffer
): void {
  console.log("[Pending offer created]", {
    leadId,
    city: offer.offeredCity,
    offeredAreas: offer.offeredAreas,
    requestedCity: offer.requestedCity,
    source: offer.source,
  });
}

export function logPendingOfferAccepted(
  leadId: string,
  offer: PendingPropertyOffer
): void {
  console.log("[Pending offer accepted]", {
    leadId,
    city: offer.offeredCity,
    offeredAreas: offer.offeredAreas,
  });
}

export function logPendingOfferCompleted(
  leadId: string,
  offer: PendingPropertyOffer
): void {
  console.log("[Pending offer completed]", {
    leadId,
    city: offer.offeredCity,
    offeredAreas: offer.offeredAreas,
  });
}
