import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLeadsListFilterKey,
  buildLeadsScopeBeforeStatusFilter,
  filterLeadsByStatusTab,
  resolveInitialStatusFilter,
} from "@/lib/leads/leads-list-filters";
import type { Lead } from "@/types/database";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function lead(
  status: Lead["status"],
  overrides: Partial<Lead> = {}
): Lead {
  return {
    id: `lead-${status}-${overrides.id ?? "1"}`,
    user_id: USER_A,
    assigned_user_id: null,
    workspace_id: "ws-1",
    client_name: "Test",
    phone: null,
    phone_normalized: null,
    interest: null,
    status,
    budget: null,
    preferred_area: null,
    property_type: null,
    timeline: null,
    intent_status: null,
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: null,
    pending_property_offer: null,
    last_message_text: null,
    last_message_sender: null,
    last_message_at: null,
    created_at: "2026-05-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("resolveInitialStatusFilter", () => {
  it("forces all when pipeline=qualified even if status=qualified in URL", () => {
    assert.equal(
      resolveInitialStatusFilter("qualified", "qualified"),
      "all"
    );
  });

  it("uses URL status when pipeline drill-down is absent", () => {
    assert.equal(resolveInitialStatusFilter("new", undefined), "new");
    assert.equal(resolveInitialStatusFilter(undefined, undefined), "all");
  });
});

describe("pipeline qualified drill-down visibility", () => {
  const leads = [
    lead("new", { id: "new" }),
    lead("qualified", { id: "q" }),
    lead("scheduled", { id: "s" }),
    lead("closed", { id: "c" }),
  ];

  const scopeInput = {
    queueFilter: "all" as const,
    pipeline: "qualified" as const,
    currentUserId: USER_A,
  };

  it("includes scheduled leads before status tab filtering", () => {
    const scoped = buildLeadsScopeBeforeStatusFilter(leads, scopeInput);
    const visible = filterLeadsByStatusTab(scoped, "all");

    assert.ok(visible.some((row) => row.status === "scheduled"));
    assert.equal(
      visible.filter((row) => row.status === "scheduled").length,
      1
    );
  });

  it("includes closed leads before status tab filtering", () => {
    const scoped = buildLeadsScopeBeforeStatusFilter(leads, scopeInput);
    const visible = filterLeadsByStatusTab(scoped, "all");

    assert.ok(visible.some((row) => row.status === "closed"));
  });

  it("excludes new leads from pipeline-qualified scope", () => {
    const scoped = buildLeadsScopeBeforeStatusFilter(leads, scopeInput);

    assert.equal(scoped.length, 3);
    assert.equal(
      scoped.some((row) => row.status === "new"),
      false
    );
  });

  it("chip scope matches table when status tab is exact qualified", () => {
    const scoped = buildLeadsScopeBeforeStatusFilter(leads, scopeInput);
    const exactQualified = filterLeadsByStatusTab(scoped, "qualified");

    assert.equal(exactQualified.length, 1);
    assert.equal(exactQualified[0]?.status, "qualified");

    const allPipelineQualified = filterLeadsByStatusTab(scoped, "all");
    assert.equal(allPipelineQualified.length, 3);
  });
});

describe("pipeline-aware chip counts", () => {
  const leads = [
    lead("new", { id: "new" }),
    lead("qualified", { id: "q" }),
    lead("scheduled", { id: "s" }),
  ];

  it("status chip counts use pipeline scope not full workspace", () => {
    const scoped = buildLeadsScopeBeforeStatusFilter(leads, {
      queueFilter: "all",
      pipeline: "qualified",
      currentUserId: USER_A,
    });

    assert.equal(scoped.length, 2);
    assert.equal(
      scoped.filter((row) => row.status === "qualified").length,
      1
    );
    assert.equal(
      scoped.filter((row) => row.status === "scheduled").length,
      1
    );
    assert.equal(
      scoped.filter((row) => row.status === "new").length,
      0
    );
  });

  it("assignee chip counts can be derived from pipeline scope per bucket", () => {
    const assignedScheduled = lead("scheduled", {
      id: "mine",
      assigned_user_id: USER_A,
    });
    const unassignedQualified = lead("qualified", { id: "open" });
    const workspace = [assignedScheduled, unassignedQualified, lead("new")];

    const mineScoped = buildLeadsScopeBeforeStatusFilter(workspace, {
      queueFilter: "me",
      pipeline: "qualified",
      currentUserId: USER_A,
    });
    const allScoped = buildLeadsScopeBeforeStatusFilter(workspace, {
      queueFilter: "all",
      pipeline: "qualified",
      currentUserId: USER_A,
    });

    assert.equal(mineScoped.length, 1);
    assert.equal(allScoped.length, 2);
  });
});

describe("buildLeadsListFilterKey", () => {
  it("changes when drill-down params change to force remount", () => {
    const fromStatus = buildLeadsListFilterKey({
      initialStatus: "qualified",
    });
    const toPipeline = buildLeadsListFilterKey({
      initialPipeline: "qualified",
    });

    assert.notEqual(fromStatus, toPipeline);
  });

  it("remount key differs for stale status vs pipeline drill-down", () => {
    assert.notEqual(
      buildLeadsListFilterKey({ initialStatus: "qualified" }),
      buildLeadsListFilterKey({ initialPipeline: "qualified" })
    );
  });
});
