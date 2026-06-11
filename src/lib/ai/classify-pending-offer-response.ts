import {
  extractCityFromMessage,
  normalizeCity,
  parseNormalizedBudget,
} from "@/lib/properties/normalize-search";
import type { PendingPropertyOffer } from "@/types/database";

export type PendingOfferResponseDecision = "accept" | "new_search" | "unclear";

export type PendingOfferResponseConfidence = "high" | "medium" | "low";

export type PendingOfferResponseClassification = {
  decision: PendingOfferResponseDecision;
  confidence: PendingOfferResponseConfidence;
  evidence: string[];
};

const LONG_MESSAGE_THRESHOLD = 120;
const SHORT_MESSAGE_THRESHOLD = 80;

const MORE_OPTIONS_PATTERN =
  /\b(mostra outras|outras opções|outras opcões|outras opcoes|tem mais|tens mais|há mais|ha mais|mais opções|mais opcões|ver semelhantes|more options|altre opzioni|más opciones)\b/i;

const REJECTION_PATTERN =
  /\b(n[aã]o|nao|no|non|pas maintenant|not now|not really)\b/i;

const AFFIRMATIVE_PATTERN =
  /\b(sim|sì|si|yes|yeah|yep|oui|ok|okay|claro|certo|va bene|sure|yup|ja|sí|dale|combinado|perfetto|perfeito)\b/i;

const SHORT_AFFIRMATIVE_ONLY =
  /^(sim|sì|si|yes|yeah|yep|oui|ok|okay|claro|certo|va bene|sure|ja|sí|dale|combinado|perfetto|perfeito)(?:[\s,!.👌🙂]*)$/i;

const POLITE_CONTINUATION_PATTERN =
  /\b(por favor|please|plz|grazie|grazie mille|obrigad[oa]|obrigado|s'il te pla[iî]t|s'il vous pla[iî]t|per favore|per piacere|bitte|por favor)\b/i;

const SHOW_SEND_PATTERN =
  /\b(mostra(?:me|-me)?|mostrar|mostre|mostrami|fammi vedere|fami vedere|envia(?:r)?|manda(?:r)?|mandar|show(?: me)?|send(?: them)?|muestrame|muéstrame|montre(?:-moi| moi)?|voir|mostrar)\b/i;

const INTEREST_PATTERN =
  /\b(quero ver|quero conhecer|let's see|lets see|go ahead|pode mostrar|podes mostrar|puoi mostrare|puoi vedere|je veux voir|quiero ver)\b/i;

const NEW_SEARCH_VERB_PATTERN =
  /\b(procuro|estou procurando|estou a procurar|procurar|procura|preciso de|preciso de uma|cerco|sto cercando|looking for|searching for|i want a house|i want a|i need a|busco|je cherche|buscar|quiero una casa|quero uma casa|voglio una casa|voglio una|estou à procura|quero)\b/i;

const PROPERTY_TYPE_PATTERN =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|estudio|studio|house|apartment|appartamento|flat|villa|home|casa|villetta|vivienda|t[0-4]|maison|appartement)\b/i;

const CITY_OR_BUDGET_SIGNAL =
  /\b(em\s+[a-zà-ú]|in\s+[a-z]|en\s+[a-z]|a\s+[a-zà-ú]|à\s+[a-zà-ú]|lisboa|porto|milano|milan|milão|firenze|florence|florença|roma|rome|london|londres|paris|madrid|barcelona|lisbon|cascais|sintra|oeiras|faro|coimbra|braga|até|fino a|hasta|orçamento|budget|presupuesto|€|\d[\d.,\s]*(mil|mila|k|milhões?))\b/i;

const PIVOT_PATTERN =
  /\b(mas agora|but now|but|pero|porém|porém|however|invece|en cambio|ahora quero|agora quero|maintenant je|now i want)\b/i;

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function detectOfferCityChange(
  text: string,
  offer: PendingPropertyOffer
): { city: string | null; differentFromOffer: boolean } {
  const city = extractCityFromMessage(text);
  if (!city) {
    return { city: null, differentFromOffer: false };
  }

  const normalizedCity = normalizeCity(city) ?? city;
  const offeredCity = normalizeCity(offer.offeredCity) ?? offer.offeredCity;
  const requestedCity = offer.requestedCity
    ? normalizeCity(offer.requestedCity) ?? offer.requestedCity
    : null;

  const differentFromOffer =
    fold(normalizedCity) !== fold(offeredCity) &&
    (!requestedCity || fold(normalizedCity) !== fold(requestedCity));

  return { city: normalizedCity, differentFromOffer };
}

function collectAcceptEvidence(text: string): string[] {
  const evidence: string[] = [];

  if (AFFIRMATIVE_PATTERN.test(text)) {
    evidence.push("accept:affirmative");
  }
  if (POLITE_CONTINUATION_PATTERN.test(text)) {
    evidence.push("accept:polite");
  }
  if (SHOW_SEND_PATTERN.test(text)) {
    evidence.push("accept:show_send");
  }
  if (INTEREST_PATTERN.test(text)) {
    evidence.push("accept:interest");
  }
  if (SHORT_AFFIRMATIVE_ONLY.test(text)) {
    evidence.push("accept:short_affirmative_only");
  }

  return evidence;
}

function collectNewSearchEvidence(
  text: string,
  offer?: PendingPropertyOffer | null
): string[] {
  const evidence: string[] = [];

  if (MORE_OPTIONS_PATTERN.test(text)) {
    evidence.push("new_search:more_options");
  }

  const hasSearchVerb = NEW_SEARCH_VERB_PATTERN.test(text);
  const hasType = PROPERTY_TYPE_PATTERN.test(text);
  const hasLocationOrBudget =
    CITY_OR_BUDGET_SIGNAL.test(text) || parseNormalizedBudget(text) != null;
  const cityChange = offer ? detectOfferCityChange(text, offer) : { city: null, differentFromOffer: false };

  if (hasSearchVerb) {
    evidence.push("new_search:search_verb");
  }
  if (hasType) {
    evidence.push("new_search:property_type");
  }
  if (hasLocationOrBudget) {
    evidence.push("new_search:location_or_budget");
  }
  if (cityChange.city && cityChange.differentFromOffer) {
    evidence.push(`new_search:city_change:${cityChange.city}`);
  }
  if (PIVOT_PATTERN.test(text)) {
    evidence.push("new_search:pivot");
  }
  if (REJECTION_PATTERN.test(text)) {
    evidence.push("new_search:rejection");
  }

  return evidence;
}

function hasExplicitNewSearch(
  text: string,
  offer?: PendingPropertyOffer | null
): boolean {
  const evidence = collectNewSearchEvidence(text, offer);
  const hasSearchVerb = evidence.includes("new_search:search_verb");
  const hasType = evidence.includes("new_search:property_type");
  const hasLocationOrBudget = evidence.includes("new_search:location_or_budget");
  const hasCityChange = evidence.some((item) => item.startsWith("new_search:city_change:"));
  const hasPivot = evidence.includes("new_search:pivot");
  const hasRejection = evidence.includes("new_search:rejection");

  if (evidence.includes("new_search:more_options")) {
    return true;
  }

  if (hasRejection && (hasSearchVerb || hasLocationOrBudget || hasCityChange)) {
    return true;
  }

  if (hasPivot && (hasSearchVerb || hasLocationOrBudget || hasCityChange)) {
    return true;
  }

  if (hasSearchVerb && (hasType || hasLocationOrBudget || hasCityChange)) {
    return true;
  }

  if (hasCityChange && (hasSearchVerb || hasType)) {
    return true;
  }

  return false;
}

function scoreAcceptConfidence(
  text: string,
  acceptEvidence: string[]
): PendingOfferResponseConfidence {
  const trimmed = text.trim();
  const signalCount = acceptEvidence.filter((item) => item.startsWith("accept:")).length;

  if (acceptEvidence.includes("accept:short_affirmative_only")) {
    return "high";
  }

  const hasAffirmative = acceptEvidence.includes("accept:affirmative");
  const hasPolite = acceptEvidence.includes("accept:polite");
  const hasShowSend = acceptEvidence.includes("accept:show_send");
  const hasInterest = acceptEvidence.includes("accept:interest");

  if (
    (hasAffirmative && hasPolite) ||
    (hasAffirmative && (hasShowSend || hasInterest)) ||
    (hasShowSend && hasInterest) ||
    (hasShowSend && trimmed.length <= SHORT_MESSAGE_THRESHOLD)
  ) {
    return "high";
  }

  if (signalCount >= 1 && trimmed.length <= SHORT_MESSAGE_THRESHOLD) {
    return "medium";
  }

  if (signalCount >= 1) {
    return "low";
  }

  return "low";
}

/**
 * Evidence-based classifier for replies when a pending property offer is active.
 */
export function classifyPendingOfferResponse(
  message: string,
  offer?: PendingPropertyOffer | null
): PendingOfferResponseClassification {
  const trimmed = message.trim();
  const evidence: string[] = [];

  if (!trimmed) {
    return { decision: "unclear", confidence: "low", evidence: ["empty"] };
  }

  const acceptEvidence = collectAcceptEvidence(trimmed);
  const newSearchEvidence = collectNewSearchEvidence(trimmed, offer);
  evidence.push(...acceptEvidence, ...newSearchEvidence);

  const explicitNewSearch = hasExplicitNewSearch(trimmed, offer);

  if (explicitNewSearch) {
    const confidence: PendingOfferResponseConfidence =
      newSearchEvidence.includes("new_search:city_change:") ||
      newSearchEvidence.includes("new_search:pivot") ||
      (newSearchEvidence.includes("new_search:search_verb") &&
        (newSearchEvidence.includes("new_search:property_type") ||
          newSearchEvidence.includes("new_search:location_or_budget")))
        ? "high"
        : "medium";

    return { decision: "new_search", confidence, evidence };
  }

  const acceptConfidence = scoreAcceptConfidence(trimmed, acceptEvidence);

  if (acceptEvidence.length > 0) {
    return {
      decision: "accept",
      confidence: acceptConfidence,
      evidence,
    };
  }

  if (trimmed.length > LONG_MESSAGE_THRESHOLD) {
    return { decision: "unclear", confidence: "low", evidence };
  }

  return { decision: "unclear", confidence: "low", evidence };
}

export function shouldAcceptPendingOfferResponse(
  classification: PendingOfferResponseClassification
): boolean {
  const hasNewSearchEvidence = classification.evidence.some((item) =>
    item.startsWith("new_search:")
  );

  if (classification.decision === "new_search" && classification.confidence === "high") {
    return false;
  }

  if (classification.decision === "accept" && classification.confidence === "high") {
    return true;
  }

  if (
    classification.decision === "accept" &&
    classification.confidence === "medium" &&
    !hasNewSearchEvidence
  ) {
    return true;
  }

  if (classification.decision === "unclear") {
    const shortAffirmative = classification.evidence.includes(
      "accept:short_affirmative_only"
    );
    const hasAcceptEvidence = classification.evidence.some((item) =>
      item.startsWith("accept:")
    );

    if (shortAffirmative) {
      return true;
    }

    if (hasAcceptEvidence && !hasNewSearchEvidence) {
      return true;
    }
  }

  return false;
}

export function logPendingOfferResponseClassified(
  leadId: string,
  message: string,
  classification: PendingOfferResponseClassification
): void {
  console.log("[Pending offer response classified]", {
    leadId,
    messagePreview: message.trim().slice(0, 120),
    decision: classification.decision,
    confidence: classification.confidence,
    evidence: classification.evidence,
  });
}

/** @deprecated Use classifyPendingOfferResponse + shouldAcceptPendingOfferResponse */
export function isPendingOfferAcceptanceMessage(
  text: string,
  offer?: PendingPropertyOffer | null
): boolean {
  const classification = classifyPendingOfferResponse(text, offer);
  return shouldAcceptPendingOfferResponse(classification);
}
