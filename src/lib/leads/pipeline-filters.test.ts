import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countLeadsByPipeline,
  filterLeadsByPipeline,
  isLeadInPipeline,
  parsePipelineFilterParam,
} from "@/lib/leads/pipeline-filters";
import type { Lead } from "@/types/database";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function lead(status: Lead["status"]): Lead {
  return {
    id: `lead-${status}`,
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
    created_at: "2026-05-01T10:00:00.000Z",
  };
}

describe("pipeline filters", () => {
  const leads = [
    lead("new"),
    lead("contacted"),
    lead("qualified"),
    lead("scheduled"),
    lead("closed"),
    lead("lost"),
  ];

  it("parses pipeline=qualified", () => {
    assert.equal(parsePipelineFilterParam("qualified"), "qualified");
    assert.equal(parsePipelineFilterParam(undefined), undefined);
  });

  it("includes qualified, scheduled, and closed in pipeline=qualified", () => {
    const filtered = filterLeadsByPipeline(leads, "qualified");
    assert.deepEqual(
      filtered.map((item) => item.status),
      ["qualified", "scheduled", "closed"]
    );
    assert.equal(countLeadsByPipeline(leads, "qualified"), 3);
  });

  it("excludes non-pipeline statuses", () => {
    assert.equal(isLeadInPipeline("new", "qualified"), false);
    assert.equal(isLeadInPipeline("contacted", "qualified"), false);
    assert.equal(isLeadInPipeline("lost", "qualified"), false);
    assert.equal(isLeadInPipeline("qualified", "qualified"), true);
    assert.equal(isLeadInPipeline("scheduled", "qualified"), true);
    assert.equal(isLeadInPipeline("closed", "qualified"), true);
  });

  it("returns all leads when pipeline filter is unset", () => {
    assert.equal(filterLeadsByPipeline(leads, undefined).length, 6);
  });
});
