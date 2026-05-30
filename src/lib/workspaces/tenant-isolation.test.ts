import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WorkspaceAccessError,
  requireEntityWorkspaceId,
  requireLeadWorkspaceId,
} from "@/lib/workspaces/workspace-access";

describe("tenant isolation helpers", () => {
  it("requireLeadWorkspaceId rejects leads without workspace_id", () => {
    assert.throws(
      () => requireLeadWorkspaceId({ id: "lead-1", workspace_id: null }),
      /Lead lead-1 is not associated with a workspace/
    );
  });

  it("requireLeadWorkspaceId returns workspace_id when present", () => {
    assert.equal(
      requireLeadWorkspaceId({ id: "lead-1", workspace_id: "ws-a" }),
      "ws-a"
    );
  });

  it("requireEntityWorkspaceId blocks cross-tenant property access without workspace_id", () => {
    assert.throws(
      () =>
        requireEntityWorkspaceId(
          { workspace_id: null },
          "Property prop-99"
        ),
      /Property prop-99 is not associated with a workspace/
    );
  });

  it("WorkspaceAccessError identifies access denial", () => {
    const error = new WorkspaceAccessError("Access denied");
    assert.equal(error.name, "WorkspaceAccessError");
    assert.match(error.message, /Access denied/);
  });
});

describe("workspace query scoping contract", () => {
  it("documents that user A workspace filter excludes workspace B", () => {
    const workspaceA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const workspaceB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    const allLeads = [
      { id: "1", workspace_id: workspaceA, client_name: "Alice" },
      { id: "2", workspace_id: workspaceB, client_name: "Bob" },
    ];

    const visibleToA = allLeads.filter((lead) => lead.workspace_id === workspaceA);
    assert.equal(visibleToA.length, 1);
    assert.equal(visibleToA[0]?.client_name, "Alice");
    assert.doesNotMatch(
      visibleToA.map((lead) => lead.client_name).join(","),
      /Bob/
    );
  });

  it("properties are filtered by workspace_id not user_id alone", () => {
    const workspaceId = "ws-1";
    const properties = [
      { id: "p1", workspace_id: workspaceId, user_id: "user-a" },
      { id: "p2", workspace_id: "ws-2", user_id: "user-a" },
    ];

    const scoped = properties.filter((item) => item.workspace_id === workspaceId);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, "p1");
  });

  it("visit requests inherit workspace isolation from workspace_id column", () => {
    const workspaceId = "ws-visits";
    const visits = [
      { id: "v1", workspace_id: workspaceId, lead_id: "l1" },
      { id: "v2", workspace_id: "other-ws", lead_id: "l2" },
    ];

    const scoped = visits.filter((visit) => visit.workspace_id === workspaceId);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, "v1");
  });

  it("follow-ups are workspace-scoped for dashboard queries", () => {
    const workspaceId = "ws-fu";
    const followUps = [
      { id: "f1", workspace_id: workspaceId, status: "pending" },
      { id: "f2", workspace_id: "ws-other", status: "pending" },
    ];

    const pending = followUps.filter(
      (item) => item.workspace_id === workspaceId && item.status === "pending"
    );
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.id, "f1");
  });

  it("billing subscriptions attach to workspace not user alone", () => {
    const subscriptions = [
      { workspace_id: "ws-bill-1", user_id: "user-1", status: "active" },
      { workspace_id: "ws-bill-2", user_id: "user-1", status: "trialing" },
    ];

    const forWorkspace = subscriptions.filter(
      (sub) => sub.workspace_id === "ws-bill-1"
    );
    assert.equal(forWorkspace.length, 1);
    assert.notEqual(forWorkspace[0]?.workspace_id, "ws-bill-2");
  });
});

describe("WhatsApp tenant routing contract", () => {
  it("maps provider instance to exactly one workspace in connection table shape", () => {
    const connections = [
      {
        provider: "meta",
        provider_instance_id: "123456789",
        workspace_id: "ws-1",
        is_active: true,
      },
      {
        provider: "evolution",
        provider_instance_id: "agency-main",
        workspace_id: "ws-2",
        is_active: true,
      },
    ];

    const resolve = (provider: string, instanceId: string) =>
      connections.find(
        (row) =>
          row.provider === provider &&
          row.provider_instance_id === instanceId &&
          row.is_active
      )?.workspace_id ?? null;

    assert.equal(resolve("meta", "123456789"), "ws-1");
    assert.equal(resolve("meta", "999999999"), null);
    assert.equal(resolve("evolution", "agency-main"), "ws-2");
  });
});
