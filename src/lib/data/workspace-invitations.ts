import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/stripe/app-url";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/team/invitation-token";
import { normalizeInvitationEmail } from "@/lib/team/validation";
import type {
  Database,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
} from "@/types/database";
import type { InvitableRole } from "@/lib/team/roles";

type Client = SupabaseClient<Database>;

const INVITATION_TTL_DAYS = 7;

function firstRow<T>(rows: T[] | null | undefined): T | null {
  return rows?.[0] ?? null;
}

function invitationExpiresAt(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + INVITATION_TTL_DAYS);
  return expires.toISOString();
}

export function buildInvitationUrl(token: string): string {
  return `${getAppUrl()}/invite/${encodeURIComponent(token)}`;
}

export async function listWorkspaceInvitations(
  supabase: Client,
  workspaceId: string
): Promise<WorkspaceInvitation[]> {
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["pending", "expired"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list workspace invitations: ${error.message}`);
  }

  return data ?? [];
}

export async function findInvitationByToken(
  supabase: Client,
  token: string
): Promise<WorkspaceInvitation | null> {
  const tokenHash = hashInvitationToken(token);
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .limit(1);

  if (error) {
    throw new Error(`Failed to lookup invitation: ${error.message}`);
  }

  return firstRow(data);
}

export async function markInvitationExpired(
  supabase: Client,
  invitationId: string
): Promise<void> {
  const { error } = await supabase
    .from("workspace_invitations")
    .update({ status: "expired" })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to expire invitation: ${error.message}`);
  }
}

export function isInvitationExpired(invitation: WorkspaceInvitation): boolean {
  if (invitation.status !== "pending") {
    return invitation.status === "expired";
  }

  return new Date(invitation.expires_at).getTime() <= Date.now();
}

export async function createWorkspaceInvitation(
  supabase: Client,
  input: {
    workspaceId: string;
    email: string;
    role: InvitableRole;
    invitedBy: string;
  }
): Promise<{ invitation: WorkspaceInvitation; inviteUrl: string; token: string }> {
  const { token, tokenHash } = generateInvitationToken();
  const normalizedEmail = normalizeInvitationEmail(input.email);

  const { data, error } = await supabase
    .from("workspace_invitations")
    .insert({
      workspace_id: input.workspaceId,
      email: normalizedEmail,
      role: input.role,
      token_hash: tokenHash,
      status: "pending",
      invited_by: input.invitedBy,
      expires_at: invitationExpiresAt(),
    })
    .select("*")
    .limit(1);

  if (error) {
    if (error.code === "23505") {
      throw new Error("A pending invitation already exists for this email.");
    }
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  const invitation = firstRow(data);
  if (!invitation) {
    throw new Error("Invitation insert returned no row.");
  }

  return {
    invitation,
    token,
    inviteUrl: buildInvitationUrl(token),
  };
}

export async function cancelWorkspaceInvitation(
  supabase: Client,
  workspaceId: string,
  invitationId: string
): Promise<void> {
  const { error } = await supabase
    .from("workspace_invitations")
    .update({ status: "canceled" })
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to cancel invitation: ${error.message}`);
  }
}

export async function resendWorkspaceInvitation(
  supabase: Client,
  workspaceId: string,
  invitationId: string
): Promise<{ invitation: WorkspaceInvitation; inviteUrl: string; token: string }> {
  const { token, tokenHash } = generateInvitationToken();

  const { data, error } = await supabase
    .from("workspace_invitations")
    .update({
      token_hash: tokenHash,
      expires_at: invitationExpiresAt(),
      status: "pending",
    })
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId)
    .in("status", ["pending", "expired"])
    .select("*")
    .limit(1);

  if (error) {
    throw new Error(`Failed to resend invitation: ${error.message}`);
  }

  const invitation = firstRow(data);
  if (!invitation) {
    throw new Error("Invitation not found or no longer pending.");
  }

  return {
    invitation,
    token,
    inviteUrl: buildInvitationUrl(token),
  };
}

export async function acceptWorkspaceInvitation(
  supabase: Client,
  input: {
    invitationId: string;
    userId: string;
  }
): Promise<WorkspaceInvitation> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .update({
      status: "accepted" satisfies WorkspaceInvitationStatus,
      accepted_at: now,
    })
    .eq("id", input.invitationId)
    .eq("status", "pending")
    .gt("expires_at", now)
    .select("*")
    .limit(1);

  if (error) {
    throw new Error(`Failed to accept invitation: ${error.message}`);
  }

  const invitation = firstRow(data);
  if (!invitation) {
    throw new Error("Invitation is no longer valid.");
  }

  return invitation;
}

export async function getPendingInvitationForEmail(
  supabase: Client,
  workspaceId: string,
  email: string
): Promise<WorkspaceInvitation | null> {
  const normalizedEmail = normalizeInvitationEmail(email);
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch pending invitation: ${error.message}`);
  }

  return firstRow(data);
}
