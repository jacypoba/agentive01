import type { FollowUpType } from "@/types/database";

export const FOLLOW_UP_CONFIG = {
  cooldownHours: 24,
  maxPerLead: 5,
  batchSize: 20,
  delaysHours: {
    property_recommended: 48,
    silent_lead: 24,
    visit_pending: 12,
    visit_completed: 24,
    new_match: 6,
  } satisfies Record<FollowUpType, number>,
} as const;
