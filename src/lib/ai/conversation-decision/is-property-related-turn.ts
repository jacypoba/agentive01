import { shouldQueryProperties, type ClassifiedIntent } from "@/lib/ai/intent-classifier";
import { clientAskedToSeeOptions } from "@/lib/ai/qualification";
import type { Conversation, Lead, PendingPropertyOffer } from "@/types/database";
import { hasPropertyPivotEvidence } from "./apply-phase-b2";
import { resolveCriteriaShadow } from "./resolve-criteria-shadow";

import {
  isPropertySearchMessage,
  PROPERTY_TYPE_PATTERN,
} from "./property-search-signals";

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

  const resolved = resolveCriteriaShadow(latestMessage, lead, pendingOffer, history);
  if (hasPropertyPivotEvidence(resolved, latestMessage, pendingOffer)) {
    return true;
  }

  if (isPropertySearchMessage(latestMessage)) {
    return true;
  }

  return false;
}
