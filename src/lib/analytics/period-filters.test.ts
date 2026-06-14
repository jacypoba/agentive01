import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnalyticsDateRangeForPeriod } from "@/lib/analytics/date-ranges";
import {
  isSentAtInAnalyticsPeriod,
  isSentAtToday,
  isTimestampInAnalyticsPeriod,
  startOfTodayIso,
} from "@/lib/analytics/period-filters";

describe("period filters", () => {
  it("includes timestamps inside a bounded analytics period", () => {
    const range = buildAnalyticsDateRangeForPeriod("30");

    assert.ok(range.start);
    assert.ok(range.end);
    assert.equal(
      isTimestampInAnalyticsPeriod(range.start, "30"),
      true
    );
    assert.equal(
      isTimestampInAnalyticsPeriod(range.end, "30"),
      true
    );
    assert.equal(
      isTimestampInAnalyticsPeriod("2000-01-01T00:00:00.000Z", "30"),
      false
    );
  });

  it("includes all timestamps for all-time period", () => {
    assert.equal(
      isTimestampInAnalyticsPeriod("2000-01-01T00:00:00.000Z", "all"),
      true
    );
  });

  it("detects sent_at values from today", () => {
    const todayIso = new Date().toISOString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    assert.equal(isSentAtToday(todayIso), true);
    assert.equal(isSentAtToday(yesterday.toISOString()), false);
    assert.equal(isSentAtToday(null), false);
    assert.equal(isSentAtToday(startOfTodayIso()), true);
  });

  it("filters sent_at by analytics period", () => {
    const range = buildAnalyticsDateRangeForPeriod("7");

    assert.ok(range.start);
    assert.ok(range.end);

    assert.equal(
      isSentAtInAnalyticsPeriod(range.start, "7"),
      true
    );
    assert.equal(
      isSentAtInAnalyticsPeriod("2000-01-01T00:00:00.000Z", "7"),
      false
    );
    assert.equal(isSentAtInAnalyticsPeriod(null, "7"), false);
  });
});
