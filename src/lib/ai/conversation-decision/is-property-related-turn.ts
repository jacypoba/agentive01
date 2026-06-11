import { shouldQueryProperties, type ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { clientAskedToSeeOptions } from "@/lib/ai/qualification";
import type { Conversation, Lead, PendingPropertyOffer } from "@/types/database";
import { hasPropertyPivotEvidence } from "./apply-phase-b2";
import { resolveCriteriaShadow } from "./resolve-criteria-shadow";

const PROPERTY_SEARCH_PATTERN =
  /\b(procuro|procurar|procura|quero|preciso|interess(?:a|o)|busco|pesquiso|looking for|searching for|cerco|cercare|voglio|quiero|buscar)\b/i;

const PROPERTY_TYPE_PATTERN =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|estudio|studio|house|apartment|appartamento|flat|villa|home|casa|villetta|vivienda)\b/i;

const CITY_SIGNAL =
  /\b(em\s+[a-zà-ú]|in\s+[a-z]|en\s+[a-z]|a\s+[a-z]|lisboa|porto|milano|milan|milão|firenze|florence|roma|madrid|paris|london)\b/i;

function isPropertySearchMessage(text: string): boolean {
  if (!text.trim()) return false;
  const hasSearchVerb = PROPERTY_SEARCH_PATTERN.test(text);
  const hasType = PROPERTY_TYPE_PATTERN.test(text);
  const hasLocation = CITY_SIGNAL.test(text);
  if (hasSearchVerb && (hasType || hasLocation)) return true;
  return hasType && hasLocation;
}

/** Whether this turn should be routed through the property decision engine (V1). */
export function isPropertyRelatedTurn(
  latestMessage: string,
  history: Conversation[],
  classified: ClassifiedIntent,
  lead: Lead,
  pendingOffer: PendingPropertyOffer | null
): boolean {
  if (shouldQueryProperties(classified)) {
    return true;
  }

  if (clientAskedToSeeOptions(history)) {
    return true;
  }

  const resolved = resolveCriteriaShadow(latestMessage, lead, pendingOffer);
  if (hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)) {
    return true;
  }

  if (isPropertySearchMessage(latestMessage)) {
    return true;
  }

  return false;
}
