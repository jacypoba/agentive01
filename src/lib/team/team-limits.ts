import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanLimits } from "@/lib/billing/plan-limits";
import { getWorkspaceSubscription } from "@/lib/billing/workspace-subscription";
import {
  countPendingInvitations,
  countWorkspaceMembers,
} from "@/lib/data/workspace-members";
import { PlanAccessError } from "@/lib/billing/plan-limits";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function countTeamSeatsUsed(
  supabase: Client,
  workspaceId: string
): Promise<number> {
  const [members, pendingInvites] = await Promise.all([
    countWorkspaceMembers(supabase, workspaceId),
    countPendingInvitations(supabase, workspaceId),
  ]);

  return members + pendingInvites;
}

export async function assertCanAddTeamSeat(
  supabase: Client,
  workspaceId: string,
  billingUserId: string
): Promise<void> {
  const subscription = await getWorkspaceSubscription(
    supabase,
    workspaceId,
    billingUserId
  );

  const limits = getPlanLimits(subscription?.plan_name ?? "starter");
  const used = await countTeamSeatsUsed(supabase, workspaceId);

  if (used >= limits.maxTeamMembers) {
    throw new PlanAccessError(
      `Team member limit reached (${limits.maxTeamMembers}). Upgrade your plan on the Billing page to invite more people.`,
      "limit"
    );
  }
}
