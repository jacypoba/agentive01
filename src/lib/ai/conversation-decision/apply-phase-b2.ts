import { searchMatchingProperties } from "@/lib/data/properties";
import { analyzePropertyAvailability } from "@/lib/properties/property-availability";
import { findCityAlternativesForCriteria } from "@/lib/properties/find-city-alternatives";
import {
  buildCityAlternativeFallbackText,
  type CityAlternativeSummary,
} from "@/lib/properties/city-alternatives";
import { pickNoMatchIntroReply } from "@/lib/ai/no-match-reply";
import type { PropertyAvailability } from "@/lib/properties/property-availability";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  Database,
  Lead,
  PendingPropertyOffer,
  Property,
  PropertySearchCriteria,
} from "@/types/database";
import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";
import type { ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { buildConversationDecisionShadow } from "./build-shadow";
import {
  decisionCriteriaToSearchCriteria,
  filterPropertiesForDecisionCity,
} from "./apply-phase-b";
import { resolveCriteriaShadow, type ResolvedCriteriaShadow } from "./resolve-criteria-shadow";
import { selectActionShadowForPivot } from "./select-action-shadow";
import type {
  ConversationDecision,
  InventorySummary,
} from "./types";

type Client = SupabaseClient<Database>;

const AVAILABILITY_ASK_PATTERN =
  /\b(tens algo|tem algo|avete qualcosa|do you have anything|have anything|anything in|something in|algo em|qualcosa a|prefiro|prefere|pr[eé]f[eè]re|prefer|instead|rather|show me|mostra(?:me|-me)?|mostrami|mu[eé]strame|quiero algo|algo en)\b/i;

const REJECTION_PATTERN =
  /\b(n[aã]o|nao|no|non|pas|not|don't|don t|doesn t|doesn't|ne\s+veux|no quiero)\b/i;

const QUALIFYING_REPLIES: Record<string, string> = {
  pt: "Claro — comprar ou arrendar, e que tipo de imóvel procura?",
  it: "Certo — acquistare o affittare, e che tipo di immobile cerca?",
  en: "Sure — are you looking to buy or rent, and what type of property?",
  es: "Claro — ¿comprar o alquilar, y qué tipo de propiedad busca?",
  fr: "D'accord — acheter ou louer, et quel type de bien cherchez-vous?",
};

export type PhaseB2PropertyResolution = {
  propertiesToRecommend: Property[];
  availability: PropertyAvailability;
  criteria: PropertySearchCriteria | null;
  isReshow: false;
  freshQueryMade: true;
  cityAlternatives: CityAlternativeSummary | null;
  decision: ConversationDecision;
  qualifyingReply: string | null;
  completePendingOffer: boolean;
};

export function isConversationDecisionEnginePhaseB2Enabled(): boolean {
  const flag = process.env.CONVERSATION_DECISION_ENGINE_PHASE_B2?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}

export function hasPropertyPivotEvidence(
  resolved: ResolvedCriteriaShadow,
  latestMessage: string,
  pendingOffer: PendingPropertyOffer | null
): boolean {
  if (!resolved.explicitCityInLatest?.trim()) {
    return false;
  }

  const offeredCity = pendingOffer?.offeredCity?.trim();
  const requestedCity = pendingOffer?.requestedCity?.trim();
  const targetCity = resolved.criteria.city;

  const cityDiffersFromOffer =
    Boolean(offeredCity && targetCity) &&
    fold(targetCity!) !== fold(offeredCity!);

  const cityDiffersFromRequested =
    Boolean(requestedCity && targetCity) &&
    fold(targetCity!) !== fold(requestedCity!);

  const asksAvailabilityInCity = AVAILABILITY_ASK_PATTERN.test(latestMessage);
  const rejectionWithCity =
    REJECTION_PATTERN.test(latestMessage) &&
    Boolean(resolved.explicitCityInLatest);

  const hasPivotSignal =
    resolved.contextUse.userOverrodePendingOffer ||
    resolved.pendingOfferRejected ||
    asksAvailabilityInCity ||
    (rejectionWithCity && (cityDiffersFromOffer || cityDiffersFromRequested));

  if (!hasPivotSignal) {
    return false;
  }

  const isBroadFirstSearchOnly =
    !pendingOffer &&
    !resolved.pendingOfferRejected &&
    !resolved.contextUse.userOverrodePendingOffer &&
    !asksAvailabilityInCity &&
    !REJECTION_PATTERN.test(latestMessage);

  return !isBroadFirstSearchOnly;
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function shouldApplyPhaseB2PropertyPivot(
  decision: ConversationDecision,
  resolved: ResolvedCriteriaShadow,
  latestMessage: string,
  pendingOffer: PendingPropertyOffer | null
): boolean {
  if (!decision.criteria.city?.trim()) {
    return false;
  }

  if (!hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)) {
    return false;
  }

  if (decision.action === "ask_clarifying_question") {
    return decision.missingCriteria.includes("propertyType");
  }

  return (
    decision.action === "show_properties" ||
    decision.action === "show_city_alternatives"
  );
}

export function logConversationDecisionPhaseB2Applied(input: {
  leadId: string;
  legacyIntent: string;
  action: ConversationDecision["action"];
  criteria: ConversationDecision["criteria"];
  reason: string;
}): void {
  console.log("[Conversation Decision Phase B2 Applied]", {
    leadId: input.leadId,
    legacyIntent: input.legacyIntent,
    action: input.action,
    criteria: input.criteria,
    reason: input.reason,
  });
}

function pickQualifyingReply(language: ConversationDecision["language"]): string {
  return QUALIFYING_REPLIES[language] ?? QUALIFYING_REPLIES.en;
}

export async function tryApplyPhaseB2PropertyPivot(
  supabase: Client,
  memoryLead: Lead,
  history: Conversation[],
  latestMessage: string,
  classified: ClassifiedIntent,
  pendingOffer: PendingPropertyOffer | null,
  language: ConversationDecision["language"]
): Promise<PhaseB2PropertyResolution | null> {
  if (!isConversationDecisionEnginePhaseB2Enabled()) {
    return null;
  }

  const resolved = resolveCriteriaShadow(
    latestMessage,
    memoryLead,
    pendingOffer,
    history
  );

  if (!hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)) {
    return null;
  }

  if (!resolved.criteria.city?.trim()) {
    return null;
  }

  if (!resolved.criteria.propertyType?.trim()) {
    const decision = buildConversationDecisionShadow({
      latestMessage,
      history,
      lead: memoryLead,
      pendingPropertyOffer: pendingOffer,
      language,
      inventorySummary: {
        matchCount: 0,
        alternativeCities: [],
        criteriaMissing: true,
      },
    });

    logConversationDecisionPhaseB2Applied({
      leadId: memoryLead.id,
      legacyIntent: classified.intent,
      action: "ask_clarifying_question",
      criteria: resolved.criteria,
      reason: "pivot_missing_property_type",
    });

    return {
      propertiesToRecommend: [],
      availability: {
        matchingTotal: 0,
        shownCount: 0,
        remainingCount: 0,
        toSend: [],
        remainingAfterSend: 0,
        allShown: false,
        noMatchesInDatabase: false,
        criteriaMissing: true,
      },
      criteria: null,
      isReshow: false,
      freshQueryMade: true,
      cityAlternatives: null,
      decision: {
        ...decision,
        action: "ask_clarifying_question",
        reason: "pivot_missing_property_type",
      },
      qualifyingReply: pickQualifyingReply(language),
      completePendingOffer: false,
    };
  }

  const searchCriteria = decisionCriteriaToSearchCriteria(resolved.criteria);
  if (!searchCriteria) {
    return null;
  }

  const workspaceId = requireLeadWorkspaceId(memoryLead);
  let matchingProperties = await searchMatchingProperties(
    supabase,
    workspaceId,
    searchCriteria,
    20
  );

  matchingProperties = filterPropertiesForDecisionCity(
    matchingProperties,
    resolved.criteria.city
  );

  let cityAlternatives: CityAlternativeSummary | null = null;
  if (matchingProperties.length === 0) {
    cityAlternatives = await findCityAlternativesForCriteria(
      supabase,
      workspaceId,
      searchCriteria
    );
  }

  const inventorySummary: InventorySummary = {
    matchCount: matchingProperties.length,
    alternativeCities: cityAlternatives?.availableCities ?? [],
    criteriaMissing: false,
  };

  const selected = selectActionShadowForPivot(
    latestMessage,
    resolved,
    inventorySummary
  );

  const decision: ConversationDecision = {
    action: selected.action,
    language,
    criteria: resolved.criteria,
    contextUse: resolved.contextUse,
    missingCriteria: selected.missingCriteria,
    reason: selected.reason,
    confidence: selected.confidence,
    replyInstruction: selected.replyInstruction,
  };

  if (!shouldApplyPhaseB2PropertyPivot(decision, resolved, latestMessage, pendingOffer)) {
    return null;
  }

  logConversationDecisionPhaseB2Applied({
    leadId: memoryLead.id,
    legacyIntent: classified.intent,
    action: decision.action,
    criteria: decision.criteria,
    reason: decision.reason,
  });

  const availability = analyzePropertyAvailability(
    matchingProperties,
    history,
    true
  );

  let propertiesToRecommend = filterPropertiesForDecisionCity(
    availability.toSend,
    resolved.criteria.city
  );

  if (
    decision.action === "show_city_alternatives" &&
    propertiesToRecommend.length === 0 &&
    cityAlternatives &&
    cityAlternatives.availableCities.length > 0
  ) {
    return {
      propertiesToRecommend: [],
      availability: {
        ...availability,
        toSend: [],
        matchingTotal: matchingProperties.length,
        noMatchesInDatabase: true,
      },
      criteria: searchCriteria,
      isReshow: false,
      freshQueryMade: true,
      cityAlternatives,
      decision,
      qualifyingReply: buildCityAlternativeFallbackText(language, cityAlternatives),
      completePendingOffer: Boolean(
        pendingOffer &&
          hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)
      ),
    };
  }

  if (decision.action === "no_match" && propertiesToRecommend.length === 0) {
    return {
      propertiesToRecommend: [],
      availability: {
        ...availability,
        toSend: [],
        matchingTotal: matchingProperties.length,
        noMatchesInDatabase: true,
      },
      criteria: searchCriteria,
      isReshow: false,
      freshQueryMade: true,
      cityAlternatives,
      decision,
      qualifyingReply: pickNoMatchIntroReply(language, history, memoryLead.id),
      completePendingOffer: Boolean(
        pendingOffer &&
          hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)
      ),
    };
  }

  const shouldCompletePendingOffer = Boolean(
    pendingOffer &&
      propertiesToRecommend.length > 0 &&
      hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)
  );

  return {
    propertiesToRecommend,
    availability: {
      ...availability,
      toSend: propertiesToRecommend,
      matchingTotal: matchingProperties.length,
    },
    criteria: searchCriteria,
    isReshow: false,
    freshQueryMade: true,
    cityAlternatives,
    decision,
    qualifyingReply: null,
    completePendingOffer: shouldCompletePendingOffer,
  };
}
