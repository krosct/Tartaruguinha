import { describe, expect, it } from "vitest";

import {
  alertTrend,
  dropRecord,
  parseHistory,
  postureShare,
  SessionRecord,
  upsertRecord,
} from "../src/history";

function record(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "a",
    startedAt: 1000,
    activeMs: 60_000,
    alerts: 0,
    goodMs: 0,
    hunchedMs: 0,
    ...overrides,
  };
}

describe("alertTrend", () => {
  it("marks the first session", () => {
    expect(alertTrend(undefined, record())).toEqual({ kind: "first" });
  });

  it("reports fewer alerts as improvement", () => {
    expect(alertTrend(record({ alerts: 6 }), record({ alerts: 3 }))).toEqual({
      kind: "change",
      percent: 50,
    });
  });

  it("reports more alerts as a negative change", () => {
    expect(alertTrend(record({ alerts: 4 }), record({ alerts: 6 }))).toEqual({
      kind: "change",
      percent: -50,
    });
  });

  it("handles a previous session without alerts", () => {
    expect(alertTrend(record(), record())).toEqual({ kind: "change", percent: 0 });
    expect(alertTrend(record(), record({ alerts: 2 }))).toEqual({ kind: "new_alerts" });
  });
});

describe("dropRecord", () => {
  it("recomputes the next session's trend against the one before the removed entry", () => {
    const history = [
      record({ id: "a", startedAt: 1, alerts: 4 }),
      record({ id: "b", startedAt: 2, alerts: 7 }),
      record({ id: "c", startedAt: 3, alerts: 0 }),
    ];
    const next = dropRecord(history, "b");
    expect(next.map((item) => item.id)).toEqual(["a", "c"]);
    expect(alertTrend(next[0], next[1])).toEqual({ kind: "change", percent: 100 });
    expect(alertTrend(undefined, dropRecord(history, "a")[0])).toEqual({ kind: "first" });
  });
});

describe("postureShare", () => {
  it("splits classified time between good and hunched", () => {
    expect(postureShare(record({ goodMs: 3000, hunchedMs: 1000 }))).toEqual({
      good: 75,
      hunched: 25,
    });
  });

  it("returns null without classified time", () => {
    expect(postureShare(record())).toBeNull();
  });
});

describe("history storage helpers", () => {
  it("drops malformed entries", () => {
    const raw = JSON.stringify([record(), { id: 1 }, null, record({ id: "b", alerts: Number.NaN })]);
    expect(parseHistory(raw)).toEqual([record()]);
    expect(parseHistory("not json")).toEqual([]);
    expect(parseHistory(null)).toEqual([]);
  });

  it("replaces a record by id and keeps chronological order", () => {
    const first = record({ id: "a", startedAt: 2000 });
    const second = record({ id: "b", startedAt: 1000 });
    const updated = upsertRecord(upsertRecord([], first), second);
    expect(updated.map((item) => item.id)).toEqual(["b", "a"]);
    const again = upsertRecord(updated, { ...first, alerts: 5 });
    expect(again).toHaveLength(2);
    expect(again[1].alerts).toBe(5);
  });
});
