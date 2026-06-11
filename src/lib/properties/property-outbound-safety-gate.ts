import {
  getPropertyCriteriaBlockReason,
  type PropertyCriteriaBlockReason,
} from "@/lib/properties/property-criteria-match";
import { derivePropertySearchCriteria } from "@/lib/properties/search-criteria";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type {
  Conversation,
  Lead,
  Property,
  PropertySearchCriteria,
} from "@/types/database";

export type PropertyOutboundSafetyGateResult = {
  allowed: Property[];
  blocked: Array<{
    property: Property;
    reason: PropertyCriteriaBlockReason;
  }>;
  finalCriteria: PropertySearchCriteria | null;
  allBlocked: boolean;
};

export function resolveFinalOutboundCriteria(
  criteria: PropertySearchCriteria | null,
  lead: Lead,
  history: Conversation[]
): PropertySearchCriteria | null {
  if (criteria?.city?.trim() || criteria?.propertyType?.trim()) {
    return criteria;
  }

  return derivePropertySearchCriteria(lead, history, {
    preferLatestMessage: true,
    relaxed: true,
  });
}

export function filterPropertiesForOutboundSafetyGate(input: {
  leadId: string;
  properties: Property[];
  finalCriteria: PropertySearchCriteria;
}): PropertyOutboundSafetyGateResult {
  const { leadId, properties, finalCriteria } = input;
  const allowed: Property[] = [];
  const blocked: PropertyOutboundSafetyGateResult["blocked"] = [];

  for (const property of properties) {
    const reason = getPropertyCriteriaBlockReason(property, finalCriteria);
    if (reason) {
      blocked.push({ property, reason });
      console.log("[Property Outbound Safety Gate Blocked]", {
        leadId,
        propertyId: property.id,
        propertyCity: property.city,
        propertyNeighborhood: property.neighborhood,
        finalCriteria,
        reason,
      });
      continue;
    }

    allowed.push(property);
  }

  if (allowed.length > 0) {
    console.log("[Property Outbound Safety Gate Passed]", {
      leadId,
      finalCriteria,
      propertyIds: allowed.map((property) => property.id),
    });
  }

  return {
    allowed,
    blocked,
    finalCriteria,
    allBlocked: properties.length > 0 && allowed.length === 0,
  };
}

export function applyPropertyOutboundSafetyGate(input: {
  leadId: string;
  properties: Property[];
  criteria: PropertySearchCriteria | null;
  lead: Lead;
  history: Conversation[];
  availability: PropertyAvailability;
}): {
  properties: Property[];
  availability: PropertyAvailability;
  allBlocked: boolean;
  finalCriteria: PropertySearchCriteria | null;
} {
  const { leadId, properties, criteria, lead, history, availability } = input;

  if (properties.length === 0) {
    return {
      properties,
      availability,
      allBlocked: false,
      finalCriteria: resolveFinalOutboundCriteria(criteria, lead, history),
    };
  }

  const finalCriteria = resolveFinalOutboundCriteria(criteria, lead, history);
  if (!finalCriteria) {
    return { properties, availability, allBlocked: false, finalCriteria: null };
  }

  const gate = filterPropertiesForOutboundSafetyGate({
    leadId,
    properties,
    finalCriteria,
  });

  if (gate.allBlocked) {
    return {
      properties: [],
      availability: {
        ...availability,
        toSend: [],
        noMatchesInDatabase: true,
        remainingAfterSend: 0,
      },
      allBlocked: true,
      finalCriteria,
    };
  }

  if (gate.blocked.length === 0) {
    return {
      properties: gate.allowed,
      availability,
      allBlocked: false,
      finalCriteria,
    };
  }

  return {
    properties: gate.allowed,
    availability: {
      ...availability,
      toSend: gate.allowed,
      remainingAfterSend: Math.max(
        0,
        availability.remainingAfterSend - gate.blocked.length
      ),
    },
    allBlocked: false,
    finalCriteria,
  };
}
