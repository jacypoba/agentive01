import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFollowUpsDrillDownHref,
  buildLeadsDrillDownHref,
  buildVisitsDrillDownHref,
  parseDrillDownPeriodParam,
  parseTodayParam,
} from "@/lib/analytics/drill-down-hrefs";
import { parsePipelineFilterParam } from "@/lib/leads/pipeline-filters";

describe("drill-down href builders", () => {
  it("builds qualified pipeline leads href", () => {
    assert.equal(
      buildLeadsDrillDownHref({ pipeline: "qualified" }),
      "/leads?pipeline=qualified"
    );
  });

  it("builds period-scoped leads href", () => {
    assert.equal(
      buildLeadsDrillDownHref({ period: "30" }),
      "/leads?period=30"
    );
  });

  it("builds qualification rate KPI href", () => {
    assert.equal(
      buildLeadsDrillDownHref({ pipeline: "qualified", period: "90" }),
      "/leads?pipeline=qualified&period=90"
    );
  });

  it("builds visit requests KPI href", () => {
    assert.equal(
      buildVisitsDrillDownHref({ period: "7" }),
      "/visits?period=7"
    );
  });

  it("builds pending visits href with status", () => {
    assert.equal(
      buildVisitsDrillDownHref({ status: "pending" }),
      "/visits?status=pending"
    );
  });

  it("builds sent follow-ups today href", () => {
    assert.equal(
      buildFollowUpsDrillDownHref({ group: "sent", today: true }),
      "/follow-ups?group=sent&today=1"
    );
  });

  it("builds follow-ups sent KPI href", () => {
    assert.equal(
      buildFollowUpsDrillDownHref({ group: "sent", period: "30" }),
      "/follow-ups?group=sent&period=30"
    );
  });

  it("returns base path when no params", () => {
    assert.equal(buildLeadsDrillDownHref(), "/leads");
    assert.equal(buildVisitsDrillDownHref(), "/visits");
    assert.equal(buildFollowUpsDrillDownHref(), "/follow-ups");
  });
});

describe("drill-down query param parsers", () => {
  it("parses pipeline=qualified", () => {
    assert.equal(parsePipelineFilterParam("qualified"), "qualified");
    assert.equal(parsePipelineFilterParam("status"), undefined);
  });

  it("parses today=1", () => {
    assert.equal(parseTodayParam("1"), true);
    assert.equal(parseTodayParam("true"), false);
    assert.equal(parseTodayParam(undefined), false);
  });

  it("parses analytics period values", () => {
    assert.equal(parseDrillDownPeriodParam("7"), "7");
    assert.equal(parseDrillDownPeriodParam("30"), "30");
    assert.equal(parseDrillDownPeriodParam("90"), "90");
    assert.equal(parseDrillDownPeriodParam("all"), "all");
    assert.equal(parseDrillDownPeriodParam("365"), undefined);
  });
});
