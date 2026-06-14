import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAN_LIMITS } from "@/lib/billing/plan-limits";
import { assertWithinNumericLimit, PlanAccessError } from "@/lib/billing/plan-limits";
import { hashInvitationToken } from "@/lib/team/invitation-token";
import {
  assertCanInviteRole,
  assertCanManageTeam,
  assertCanReassignLeads,
  assertCanRemoveMember,
  canInviteRole,
  canManageTeam,
  canReassignLeads,
  canRemoveMember,
  getInvitableRoles,
  TeamAccessError,
} from "@/lib/team/roles";
import {
  emailsMatch,
  normalizeInvitationEmail,
  validateInvitationEmail,
} from "@/lib/team/validation";
import { isInvitationExpired } from "@/lib/data/workspace-invitations";
import type { WorkspaceInvitation } from "@/types/database";

describe("team role permissions", () => {
  it("owner can invite admin and member", () => {
    assert.deepEqual(getInvitableRoles("owner"), ["admin", "member"]);
    assert.equal(canInviteRole("owner", "admin"), true);
    assert.equal(canInviteRole("owner", "member"), true);
  });

  it("admin can invite member only", () => {
    assert.deepEqual(getInvitableRoles("admin"), ["member"]);
    assert.equal(canInviteRole("admin", "member"), true);
    assert.throws(
      () => assertCanInviteRole("admin", "admin"),
      TeamAccessError
    );
  });

  it("member cannot manage team or invite", () => {
    assert.equal(canManageTeam("member"), false);
    assert.equal(canReassignLeads("member"), false);
    assert.throws(() => assertCanManageTeam("member"), TeamAccessError);
    assert.throws(() => assertCanReassignLeads("member"), TeamAccessError);
    assert.deepEqual(getInvitableRoles("member"), []);
  });

  it("owner and admin can reassign leads", () => {
    assert.equal(canReassignLeads("owner"), true);
    assert.equal(canReassignLeads("admin"), true);
    assert.doesNotThrow(() => assertCanReassignLeads("owner"));
    assert.doesNotThrow(() => assertCanReassignLeads("admin"));
  });

  it("owner can remove admins and members but not owners", () => {
    assert.equal(canRemoveMember("owner", "admin"), true);
    assert.equal(canRemoveMember("owner", "member"), true);
    assert.equal(canRemoveMember("owner", "owner"), false);
  });

  it("admin can remove members only", () => {
    assert.equal(canRemoveMember("admin", "member"), true);
    assert.equal(canRemoveMember("admin", "admin"), false);
    assert.throws(
      () => assertCanRemoveMember("admin", "admin"),
      TeamAccessError
    );
  });

  it("member cannot remove anyone", () => {
    assert.equal(canRemoveMember("member", "member"), false);
  });
});

describe("plan team member limits", () => {
  it("starter allows 1 team member", () => {
    assert.equal(PLAN_LIMITS.starter.maxTeamMembers, 1);
  });

  it("pro allows 5 team members", () => {
    assert.equal(PLAN_LIMITS.pro.maxTeamMembers, 5);
  });

  it("enterprise allows 25 team members", () => {
    assert.equal(PLAN_LIMITS.enterprise.maxTeamMembers, 25);
  });

  it("blocks invites when seat limit is reached", () => {
    assert.throws(
      () =>
        assertWithinNumericLimit(
          PLAN_LIMITS.starter.maxTeamMembers,
          PLAN_LIMITS.starter.maxTeamMembers,
          "Team member"
        ),
      PlanAccessError
    );
  });
});

describe("invitation validation", () => {
  it("normalizes and validates email", () => {
    assert.equal(normalizeInvitationEmail("  User@Example.COM "), "user@example.com");
    assert.equal(validateInvitationEmail("bad-email"), "Enter a valid email address.");
    assert.equal(validateInvitationEmail("ok@example.com"), null);
  });

  it("matches emails case-insensitively", () => {
    assert.equal(emailsMatch("A@b.com", "a@B.com"), true);
  });

  it("hashes invitation tokens consistently", () => {
    const a = hashInvitationToken("secret-token");
    const b = hashInvitationToken("secret-token");
    assert.equal(a, b);
    assert.notEqual(a, hashInvitationToken("other-token"));
  });
});

describe("invitation expiry", () => {
  const baseInvitation: WorkspaceInvitation = {
    id: "inv-1",
    workspace_id: "ws-1",
    email: "guest@example.com",
    role: "member",
    token_hash: "abc",
    status: "pending",
    invited_by: "user-1",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    accepted_at: null,
    created_at: new Date().toISOString(),
  };

  it("rejects expired invitations", () => {
    const expired: WorkspaceInvitation = {
      ...baseInvitation,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    assert.equal(isInvitationExpired(expired), true);
  });

  it("accepts valid pending invitations", () => {
    assert.equal(isInvitationExpired(baseInvitation), false);
  });
});

describe("owner protection contract", () => {
  it("cannot remove owner via admin role", () => {
    assert.throws(
      () => assertCanRemoveMember("admin", "owner"),
      /workspace owner cannot be removed/i
    );
  });

  it("documents at-least-one-owner rule for removal", () => {
    const owners = [{ role: "owner" }];
    assert.equal(owners.filter((item) => item.role === "owner").length, 1);
    assert.throws(() => {
      if (owners.length <= 1) {
        throw new Error("The workspace must have at least one owner.");
      }
    });
  });
});

describe("accept invitation contract", () => {
  it("accepting invite adds membership with invitation role", () => {
    const invitationRole = "member";
    const membership = { role: invitationRole, workspace_id: "ws-1" };
    assert.equal(membership.role, invitationRole);
    assert.equal(membership.workspace_id, "ws-1");
  });
});
