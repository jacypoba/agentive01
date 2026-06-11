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

export {
  classifyPendingOfferResponse,
  isPendingOfferAcceptanceMessage,
  logPendingOfferResponseClassified,
  shouldAcceptPendingOfferResponse,
} from "@/lib/ai/classify-pending-offer-response";

export type {
  PendingOfferResponseClassification,
  PendingOfferResponseDecision,
  PendingOfferResponseConfidence,
} from "@/lib/ai/classify-pending-offer-response";

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
