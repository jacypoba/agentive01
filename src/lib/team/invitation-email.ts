export type TeamInvitationEmailPayload = {
  to: string;
  workspaceName: string;
  role: string;
  inviteUrl: string;
  invitedByName: string | null;
};

export type TeamInvitationEmailResult = {
  sent: boolean;
  provider: string | null;
};

/**
 * Sends a team invitation email when a provider is configured.
 * Until then, callers should surface `inviteUrl` in the UI.
 */
export async function sendTeamInvitationEmail(
  _payload: TeamInvitationEmailPayload
): Promise<TeamInvitationEmailResult> {
  const provider = process.env.TEAM_INVITE_EMAIL_PROVIDER?.trim();

  if (!provider) {
    return { sent: false, provider: null };
  }

  // Future: Resend, SendGrid, Postmark, etc.
  console.log("[Team invite email] Provider configured but not implemented", {
    provider,
  });

  return { sent: false, provider: null };
}
