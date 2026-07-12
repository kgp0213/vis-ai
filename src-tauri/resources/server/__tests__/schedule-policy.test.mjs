import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeNextScheduleRun, isScheduleAllowedAt, isValidRunWindow, normalizeDayOfWeek } from "../lib/schedule-policy.mjs";

describe("schedule time policy", () => {
  it("validates run windows and day values", () => {
    assert.equal(isValidRunWindow("09:00", "18:00"), true);
    assert.equal(isValidRunWindow("18:00", "09:00"), false);
    assert.equal(normalizeDayOfWeek(8), 6);
  });

  it("computes interval and daily runs deterministically", () => {
    const from = new Date(2026, 6, 13, 8, 0, 0).getTime();
    assert.equal(computeNextScheduleRun({ enabled: true, type: "interval", intervalMs: 60_000 }, from), new Date(from + 60_000).toISOString());
    const daily = computeNextScheduleRun({ enabled: true, type: "daily", timeOfDay: "09:30" }, from);
    assert.equal(new Date(daily).getHours(), 9);
    assert.equal(new Date(daily).getMinutes(), 30);
  });

  it("moves a weekend run to the next weekday window", () => {
    const saturday = new Date(2026, 6, 18, 10, 0, 0).getTime();
    const task = { enabled: true, type: "interval", intervalMs: 60_000, weekdaysOnly: true, windowEnabled: true, windowStart: "09:00", windowEnd: "18:00" };
    const next = new Date(computeNextScheduleRun(task, saturday));
    assert.equal(next.getDay(), 1);
    assert.equal(next.getHours(), 9);
    assert.equal(isScheduleAllowedAt(task, next.getTime()).ok, true);
  });
});
