import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateLanguageDistribution } from "@/lib/analytics/aggregate";
import {
  countSentFollowUpsInPeriod,
  isFollowUpSentInRange,
} from "@/lib/analytics/follow-up-metrics";
import { preferredLanguageLabel } from "@/lib/analytics/language-metrics";
import { LISTINGS_KPI_LABEL } from "@/lib/analytics/get-analytics-data";
import {
  countQualifiedLeads,
  isQualifiedLeadStatus,
  QUALIFIED_LEAD_STATUSES,
} from "@/lib/analytics/qualification-metrics";
import type { AnalyticsDateRange } from "@/lib/analytics/types";
import type { FollowUpAnalyticsRow } from "@/lib/analytics/queries";

const range: AnalyticsDateRange = {
  label: "Last 30 days",
  period: "30",
  days: 30,
  start: "2026-05-01T00:00:00.000Z",
  end: "2026-05-31T23:59:59.999Z",
  allTime: false,
};

describe("follow-up sent_at analytics", () => {
  const sentInRange: FollowUpAnalyticsRow = {
    created_at: "2026-04-01T10:00:00.000Z",
    sent_at: "2026-05-15T12:00:00.000Z",
    status: "sent",
  };

  const sentOutsideRange: FollowUpAnalyticsRow = {
    created_at: "2026-05-20T10:00:00.000Z",
    sent_at: "2026-04-20T12:00:00.000Z",
    status: "sent",
  };

  const pendingInRange: FollowUpAnalyticsRow = {
    created_at: "2026-05-10T10:00:00.000Z",
    sent_at: null,
    status: "pending",
  };

  it("counts sent follow-ups by sent_at, not created_at", () => {
    const rows = [sentInRange, sentOutsideRange, pendingInRange];
    assert.equal(countSentFollowUpsInPeriod(rows, range), 1);
    assert.equal(isFollowUpSentInRange(sentInRange, range), true);
    assert.equal(isFollowUpSentInRange(sentOutsideRange, range), false);
    assert.equal(isFollowUpSentInRange(pendingInRange, range), false);
  });

  it("includes all sent rows when range is all time", () => {
    const allTime: AnalyticsDateRange = {
      label: "All time",
      period: "all",
      days: null,
      start: null,
      end: null,
      allTime: true,
    };

    assert.equal(
      countSentFollowUpsInPeriod([sentInRange, sentOutsideRange], allTime),
      2
    );
  });
});

describe("preferred language mapping", () => {
  for (const [code, label] of [
    ["pt", "Portuguese"],
    ["en", "English"],
    ["it", "Italian"],
    ["es", "Spanish"],
    ["fr", "French"],
  ] as const) {
    it(`maps ${code} to ${label}`, () => {
      assert.equal(preferredLanguageLabel(code), label);
    });
  }

  it("maps French leads in language distribution chart", () => {
    const distribution = aggregateLanguageDistribution([
      { preferred_language: "fr" },
      { preferred_language: "fr" },
      { preferred_language: "pt" },
    ]);

    const french = distribution.find((item) => item.name === "French");
    assert.ok(french);
    assert.equal(french.value, 2);
  });
});

describe("qualification consistency", () => {
  it("uses qualified, scheduled, and closed as pipeline-qualified", () => {
    assert.deepEqual(QUALIFIED_LEAD_STATUSES, [
      "qualified",
      "scheduled",
      "closed",
    ]);
    assert.equal(isQualifiedLeadStatus("qualified"), true);
    assert.equal(isQualifiedLeadStatus("scheduled"), true);
    assert.equal(isQualifiedLeadStatus("closed"), true);
    assert.equal(isQualifiedLeadStatus("new"), false);
    assert.equal(isQualifiedLeadStatus("contacted"), false);
  });

  it("counts qualified leads consistently for card, KPI, and funnel", () => {
    const rows = [
      { status: "new" as const },
      { status: "qualified" as const },
      { status: "scheduled" as const },
      { status: "closed" as const },
      { status: "contacted" as const },
    ];

    assert.equal(countQualifiedLeads(rows), 3);
  });
});

describe("listings metric label", () => {
  it("uses Total listings because properties have no active status column", () => {
    assert.equal(LISTINGS_KPI_LABEL, "Total listings");
  });
});
