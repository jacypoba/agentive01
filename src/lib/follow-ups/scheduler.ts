import {
  isFollowUpsEnabledForWorkspace,
} from "@/lib/billing/workspace-subscription";
import {
  cancelPendingFollowUpsForLead,
  countSentFollowUpsForLead,
  createFollowUp,
  getLastSentFollowUpAt,
  getPendingFollowUpByType,
} from "@/lib/data/follow-ups";
import { FOLLOW_UP_CONFIG } from "@/lib/follow-ups/config";
import { buildFollowUpContext } from "@/lib/follow-ups/context";
import { generateFollowUpMessageForWorkspace } from "@/lib/follow-ups/generate-workspace-follow-up";
import { normalizeLanguage } from "@/lib/i18n/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  Database,
  FollowUp,
  FollowUpContextSnapshot,
  FollowUpType,
  Lead,
  Property,
  VisitRequest,
} from "@/types/database";

import { requireLeadWorkspaceId } from "@/lib/workspaces/workspace-access";

type Client = SupabaseClient<Database>;

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function isLeadEligibleForFollowUp(lead: Lead): boolean {
  if (lead.status === "closed" || lead.status === "lost") {
    return false;
  }
  if (lead.intent_status === "not_interested") {
    return false;
  }
  if (!lead.phone && !lead.phone_normalized) {
    return false;
  }
  return true;
}

async function canScheduleFollowUp(
  supabase: Client,
  lead: Lead
): Promise<{ allowed: boolean; reason?: string }> {
  if (!isLeadEligibleForFollowUp(lead)) {
    return { allowed: false, reason: "lead_inactive" };
  }

  const workspaceId = requireLeadWorkspaceId(lead);
  const followUpsEnabled = await isFollowUpsEnabledForWorkspace(
    supabase,
    workspaceId,
    lead.user_id
  );
  if (!followUpsEnabled) {
    return { allowed: false, reason: "plan_limit" };
  }

  const sentCount = await countSentFollowUpsForLead(supabase, workspaceId, lead.id);
  if (sentCount >= FOLLOW_UP_CONFIG.maxPerLead) {
    return { allowed: false, reason: "max_reached" };
  }

  const lastSentAt = await getLastSentFollowUpAt(supabase, workspaceId, lead.id);
  if (lastSentAt) {
    const cooldownUntil = addHours(
      new Date(lastSentAt),
      FOLLOW_UP_CONFIG.cooldownHours
    );
    if (cooldownUntil > new Date()) {
      return { allowed: false, reason: "cooldown" };
    }
  }

  return { allowed: true };
}

export async function scheduleFollowUp(
  supabase: Client,
  params: {
    lead: Lead;
    type: FollowUpType;
    scheduledFor?: Date;
    context: FollowUpContextSnapshot;
    message?: string;
    replacePending?: boolean;
    force?: boolean;
  }
): Promise<FollowUp | null> {
  const { lead, type, context } = params;

  if (params.force) {
    if (!isLeadEligibleForFollowUp(lead)) {
      return null;
    }

    const workspaceId = requireLeadWorkspaceId(lead);
    const followUpsEnabled = await isFollowUpsEnabledForWorkspace(
      supabase,
      workspaceId,
      lead.user_id
    );
    if (!followUpsEnabled) {
      console.log("[Follow-ups] Skipped schedule (force)", {
        leadId: lead.id,
        type,
        reason: "subscription_or_plan",
      });
      return null;
    }
  } else {
    const eligibility = await canScheduleFollowUp(supabase, lead);
    if (!eligibility.allowed) {
      console.log("[Follow-ups] Skipped schedule", {
        leadId: lead.id,
        type,
        reason: eligibility.reason,
      });
      return null;
    }
  }

  const workspaceId = requireLeadWorkspaceId(lead);
  const existingPending = await getPendingFollowUpByType(
    supabase,
    workspaceId,
    lead.id,
    type
  );
  if (existingPending && !params.replacePending) {
    return existingPending;
  }

  if (existingPending && params.replacePending) {
    await cancelPendingFollowUpsForLead(supabase, workspaceId, lead.id, [type]);
  }

  const scheduledFor =
    params.scheduledFor ??
    addHours(new Date(), FOLLOW_UP_CONFIG.delaysHours[type]);

  const message =
    params.message ??
    (await generateFollowUpMessageForWorkspace(
      supabase,
      workspaceId,
      type,
      { ...context, preferred_language: lead.preferred_language ?? context.preferred_language },
      `${lead.id}:${scheduledFor.toISOString()}`,
      normalizeLanguage(lead.preferred_language ?? context.preferred_language)
    ));

  const followUp = await createFollowUp(supabase, {
    lead_id: lead.id,
    user_id: lead.user_id,
    type,
    status: "pending",
    scheduled_for: scheduledFor.toISOString(),
    message,
    context_snapshot: context,
  });

  console.log("[Follow-ups] Scheduled", {
    followUpId: followUp.id,
    leadId: lead.id,
    type,
    scheduledFor: followUp.scheduled_for,
  });

  return followUp;
}

export async function scheduleAfterPropertyRecommendations(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  propertiesSent: Property[]
): Promise<void> {
  if (propertiesSent.length === 0) {
    return;
  }

  const context = await buildFollowUpContext(supabase, lead, history);

  await scheduleFollowUp(supabase, {
    lead,
    type: "property_recommended",
    context,
    replacePending: true,
  });
}

export async function scheduleForPendingVisit(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  visit: VisitRequest
): Promise<void> {
  const context = await buildFollowUpContext(supabase, lead, history, { visit });

  await scheduleFollowUp(supabase, {
    lead,
    type: "visit_pending",
    context,
    replacePending: true,
  });
}

export async function scheduleForConfirmedVisit(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  visit: VisitRequest,
  scheduledStart?: string | null
): Promise<void> {
  const context = await buildFollowUpContext(supabase, lead, history, { visit });
  const base = scheduledStart ? new Date(scheduledStart) : new Date();
  const scheduledFor = addHours(base, FOLLOW_UP_CONFIG.delaysHours.visit_completed);

  await cancelPendingFollowUpsForLead(
    supabase,
    requireLeadWorkspaceId(lead),
    lead.id,
    ["visit_pending"]
  );

  await scheduleFollowUp(supabase, {
    lead,
    type: "visit_completed",
    context,
    scheduledFor,
    replacePending: true,
  });
}

export async function scheduleForNewMatchingProperty(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  property: Property
): Promise<FollowUp | null> {
  const context = await buildFollowUpContext(supabase, lead, history, {
    newProperty: property,
  });

  return scheduleFollowUp(supabase, {
    lead,
    type: "new_match",
    context,
    replacePending: true,
  });
}

export async function cancelFollowUpsOnClientReply(
  supabase: Client,
  lead: Lead
): Promise<void> {
  const cancelled = await cancelPendingFollowUpsForLead(
    supabase,
    requireLeadWorkspaceId(lead),
    lead.id
  );
  if (cancelled > 0) {
    console.log("[Follow-ups] Cancelled on client reply", {
      leadId: lead.id,
      cancelled,
    });
  }
}

export async function scheduleSilentLeadIfNeeded(
  supabase: Client,
  lead: Lead,
  history: Conversation[],
  lastClientMessageAt: Date
): Promise<FollowUp | null> {
  const hoursSince =
    (Date.now() - lastClientMessageAt.getTime()) / (1000 * 60 * 60);

  if (hoursSince < FOLLOW_UP_CONFIG.delaysHours.silent_lead) {
    return null;
  }

  const lastMessage = history.at(-1);
  if (!lastMessage || lastMessage.sender === "client") {
    return null;
  }

  const context = await buildFollowUpContext(supabase, lead, history);

  return scheduleFollowUp(supabase, {
    lead,
    type: "silent_lead",
    context,
    scheduledFor: new Date(),
    replacePending: true,
  });
}
