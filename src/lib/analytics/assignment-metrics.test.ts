import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAgentPerformance,
  computeAgentConversionRate,
  resolveAssigneeBucketKey,
  UNASSIGNED_BUCKET_KEY,
} from "@/lib/analytics/assignment-metrics";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const FORMER_MEMBER = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const members = [
  { userId: USER_A, label: "Agent Alpha" },
  { userId: USER_B, label: "Agent Beta" },
];

describe("leads per agent", () => {
  it("counts leads by assigned_user_id for each workspace member", () => {
    const rows = aggregateAgentPerformance({
      members,
      leadRows: [
        {
          created_at: "2026-05-10T10:00:00.000Z",
          status: "new",
          assigned_user_id: USER_A,
        },
        {
          created_at: "2026-05-11T10:00:00.000Z",
          status: "contacted",
          assigned_user_id: USER_A,
        },
        {
          created_at: "2026-05-12T10:00:00.000Z",
          status: "new",
          assigned_user_id: USER_B,
        },
      ],
      visitRows: [],
      followUpRows: [],
    });

    const alpha = rows.find((row) => row.assigneeId === USER_A);
    const beta = rows.find((row) => row.assigneeId === USER_B);
    const unassigned = rows.find((row) => row.isUnassigned);

    assert.equal(alpha?.leads, 2);
    assert.equal(beta?.leads, 1);
    assert.equal(unassigned?.leads, 0);
  });

  it("includes zero-value rows for members with no leads", () => {
    const rows = aggregateAgentPerformance({
      members,
      leadRows: [
        {
          created_at: "2026-05-10T10:00:00.000Z",
          status: "new",
          assigned_user_id: USER_A,
        },
      ],
      visitRows: [],
      followUpRows: [],
    });

    const beta = rows.find((row) => row.assigneeId === USER_B);
    assert.ok(beta);
    assert.equal(beta.leads, 0);
    assert.equal(beta.qualified, 0);
    assert.equal(beta.visits, 0);
    assert.equal(beta.followUpsSent, 0);
  });
});

describe("qualified per agent", () => {
  it("counts qualified, scheduled, and closed leads per assignee", () => {
    const rows = aggregateAgentPerformance({
      members,
      leadRows: [
        {
          created_at: "2026-05-10T10:00:00.000Z",
          status: "qualified",
          assigned_user_id: USER_A,
        },
        {
          created_at: "2026-05-11T10:00:00.000Z",
          status: "scheduled",
          assigned_user_id: USER_A,
        },
        {
          created_at: "2026-05-12T10:00:00.000Z",
          status: "closed",
          assigned_user_id: USER_B,
        },
        {
          created_at: "2026-05-13T10:00:00.000Z",
          status: "new",
          assigned_user_id: USER_B,
        },
      ],
      visitRows: [],
      followUpRows: [],
    });

    assert.equal(rows.find((row) => row.assigneeId === USER_A)?.qualified, 2);
    assert.equal(rows.find((row) => row.assigneeId === USER_B)?.qualified, 1);
  });
});

describe("conversion rate per agent", () => {
  it("computes qualified ÷ leads per assignee", () => {
    const rows = aggregateAgentPerformance({
      members,
      leadRows: [
        {
          created_at: "2026-05-10T10:00:00.000Z",
          status: "qualified",
          assigned_user_id: USER_A,
        },
        {
          created_at: "2026-05-11T10:00:00.000Z",
          status: "new",
          assigned_user_id: USER_A,
        },
        {
          created_at: "2026-05-12T10:00:00.000Z",
          status: "closed",
          assigned_user_id: USER_B,
        },
      ],
      visitRows: [],
      followUpRows: [],
    });

    assert.equal(rows.find((row) => row.assigneeId === USER_A)?.conversionRate, 50);
    assert.equal(rows.find((row) => row.assigneeId === USER_B)?.conversionRate, 100);
  });

  it("returns 0% when an agent has no leads", () => {
    assert.equal(computeAgentConversionRate(3, 0), 0);

    const rows = aggregateAgentPerformance({
      members,
      leadRows: [],
      visitRows: [],
      followUpRows: [],
    });

    for (const row of rows) {
      assert.equal(row.conversionRate, 0);
    }
  });
});

describe("visits attribution", () => {
  it("attributes visits via leads.assigned_user_id", () => {
    const rows = aggregateAgentPerformance({
      members,
      leadRows: [],
      visitRows: [
        {
          created_at: "2026-05-10T10:00:00.000Z",
          assigned_user_id: USER_A,
        },
        {
          created_at: "2026-05-11T10:00:00.000Z",
          assigned_user_id: USER_B,
        },
        {
          created_at: "2026-05-12T10:00:00.000Z",
          assigned_user_id: USER_B,
        },
      ],
      followUpRows: [],
    });

    assert.equal(rows.find((row) => row.assigneeId === USER_A)?.visits, 1);
    assert.equal(rows.find((row) => row.assigneeId === USER_B)?.visits, 2);
  });

  it("does not create a row for non-member assignee ids — folds into unassigned", () => {
    const memberIds = new Set([USER_A, USER_B]);
    assert.equal(
      resolveAssigneeBucketKey(FORMER_MEMBER, memberIds),
      UNASSIGNED_BUCKET_KEY
    );

    const rows = aggregateAgentPerformance({
      members,
      leadRows: [],
      visitRows: [
        {
          created_at: "2026-05-10T10:00:00.000Z",
          assigned_user_id: FORMER_MEMBER,
        },
      ],
      followUpRows: [],
    });

    assert.equal(rows.find((row) => row.isUnassigned)?.visits, 1);
    assert.equal(rows.filter((row) => row.assigneeId === FORMER_MEMBER).length, 0);
  });
});

describe("follow-ups attribution", () => {
  it("attributes sent follow-ups via leads.assigned_user_id", () => {
    const rows = aggregateAgentPerformance({
      members,
      leadRows: [],
      visitRows: [],
      followUpRows: [
        {
          sent_at: "2026-05-15T12:00:00.000Z",
          assigned_user_id: USER_A,
        },
        {
          sent_at: "2026-05-16T12:00:00.000Z",
          assigned_user_id: USER_A,
        },
        {
          sent_at: "2026-05-17T12:00:00.000Z",
          assigned_user_id: USER_B,
        },
      ],
    });

    assert.equal(rows.find((row) => row.assigneeId === USER_A)?.followUpsSent, 2);
    assert.equal(rows.find((row) => row.assigneeId === USER_B)?.followUpsSent, 1);
  });
});

describe("unassigned bucket", () => {
  it("counts null assignees and unknown members in the unassigned row", () => {
    const rows = aggregateAgentPerformance({
      members,
      leadRows: [
        {
          created_at: "2026-05-10T10:00:00.000Z",
          status: "qualified",
          assigned_user_id: null,
        },
        {
          created_at: "2026-05-11T10:00:00.000Z",
          status: "new",
          assigned_user_id: FORMER_MEMBER,
        },
      ],
      visitRows: [
        {
          created_at: "2026-05-12T10:00:00.000Z",
          assigned_user_id: null,
        },
      ],
      followUpRows: [
        {
          sent_at: "2026-05-13T12:00:00.000Z",
          assigned_user_id: null,
        },
      ],
    });

    const unassigned = rows.find((row) => row.isUnassigned);
    assert.ok(unassigned);
    assert.equal(unassigned.agentLabel, "Unassigned");
    assert.equal(unassigned.assigneeId, null);
    assert.equal(unassigned.leads, 2);
    assert.equal(unassigned.qualified, 1);
    assert.equal(unassigned.conversionRate, 50);
    assert.equal(unassigned.visits, 1);
    assert.equal(unassigned.followUpsSent, 1);
  });

  it("always appends the unassigned row after member rows", () => {
    const rows = aggregateAgentPerformance({
      members: [{ userId: USER_C, label: "Solo Agent" }],
      leadRows: [],
      visitRows: [],
      followUpRows: [],
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.assigneeId, USER_C);
    assert.equal(rows[1]?.isUnassigned, true);
  });
});
