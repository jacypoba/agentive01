"use client";

import { useActionState, useState, useTransition } from "react";
import {
  cancelInvitationAction,
  inviteTeamMemberAction,
  removeTeamMemberAction,
  resendInvitationAction,
  type TeamActionState,
} from "@/app/actions/team";
import type { WorkspaceMemberWithProfile } from "@/lib/data/workspace-members";
import { getInvitableRoles } from "@/lib/team/roles";
import type { WorkspaceInvitation, WorkspaceRole } from "@/types/database";

type TeamSettingsPanelProps = {
  members: WorkspaceMemberWithProfile[];
  invitations: WorkspaceInvitation[];
  actorRole: WorkspaceRole;
  seatLimit: number;
  seatsUsed: number;
  canManage: boolean;
};

const initialState: TeamActionState = {};

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value)
  );
}

export function TeamSettingsPanel({
  members,
  invitations,
  actorRole,
  seatLimit,
  seatsUsed,
  canManage,
}: TeamSettingsPanelProps) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteTeamMemberAction,
    initialState
  );
  const [actionMessage, setActionMessage] = useState<TeamActionState | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const invitableRoles = getInvitableRoles(actorRole);

  const latestInviteUrl = inviteState.inviteUrl ?? actionMessage?.inviteUrl;

  function runAction(action: () => Promise<TeamActionState>) {
    startTransition(async () => {
      const result = await action();
      setActionMessage(result);
    });
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/35">
              Team seats
            </p>
            <p className="mt-1 text-sm text-white/50">
              {seatsUsed} of {seatLimit} seats used (members + pending invites)
            </p>
          </div>
        </div>
      </div>

      {(inviteState.error ||
        inviteState.success ||
        actionMessage?.error ||
        actionMessage?.success) && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            inviteState.error || actionMessage?.error
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {inviteState.error ??
            actionMessage?.error ??
            inviteState.success ??
            actionMessage?.success}
        </div>
      )}

      {latestInviteUrl && canManage && (
        <div className="rounded-2xl border border-[#0066FF]/30 bg-[#0066FF]/10 p-5">
          <p className="text-sm font-medium text-white">Invitation link</p>
          <p className="mt-1 text-xs text-white/45">
            Email is not configured yet — share this link with the invitee.
          </p>
          <code className="mt-3 block break-all rounded-lg bg-black/30 px-3 py-2 text-xs text-[#00D4FF]">
            {latestInviteUrl}
          </code>
        </div>
      )}

      {canManage && invitableRoles.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white">Invite member</h2>
          <p className="mt-1 text-sm text-white/45">
            {actorRole === "owner"
              ? "Invite admins or members to your workspace."
              : "Invite members to your workspace."}
          </p>

          <form action={inviteAction} className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
            <input
              name="email"
              type="email"
              required
              placeholder="colleague@agency.com"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#0066FF]/50"
            />
            <select
              name="role"
              defaultValue="member"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#0066FF]/50"
            >
              {invitableRoles.map((role) => (
                <option key={role} value={role} className="bg-[#0a0a0f]">
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={invitePending || seatsUsed >= seatLimit}
              className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {invitePending ? "Inviting…" : "Send invite"}
            </button>
          </form>

          {seatsUsed >= seatLimit && (
            <p className="mt-3 text-xs text-amber-300">
              Team member limit reached. Upgrade your plan on the Billing page.
            </p>
          )}
        </section>
      )}

      {!canManage && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/45">
          Only workspace owners and admins can invite or remove team members.
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        <ul className="mt-4 divide-y divide-white/5">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-white">
                  {member.full_name ?? "Unnamed user"}
                </p>
                <p className="text-sm text-white/45">{member.email ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-white/60">
                  {member.role}
                </span>
                {canManage &&
                  member.role !== "owner" &&
                  ((actorRole === "owner" &&
                    (member.role === "admin" || member.role === "member")) ||
                    (actorRole === "admin" && member.role === "member")) && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        runAction(() => removeTeamMemberAction(member.id))
                      }
                      className="rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canManage && invitations.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white">
            Pending invitations
          </h2>
          <ul className="mt-4 divide-y divide-white/5">
            {invitations.map((invitation) => {
              const expired =
                invitation.status === "expired" ||
                new Date(invitation.expires_at).getTime() <= Date.now();

              return (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{invitation.email}</p>
                    <p className="text-sm text-white/45">
                      {roleLabel(invitation.role)} · expires{" "}
                      {formatDate(invitation.expires_at)}
                      {expired ? " (expired)" : ""}
                    </p>
                  </div>
                  {invitation.status === "pending" && !expired && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          runAction(() => resendInvitationAction(invitation.id))
                        }
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          runAction(() => cancelInvitationAction(invitation.id))
                        }
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {(invitation.status === "expired" || expired) && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        runAction(() => resendInvitationAction(invitation.id))
                      }
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
                    >
                      Renew invite
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
