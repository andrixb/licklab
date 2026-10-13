// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  changesSince,
  chunkRecords,
  isTombstone,
  lastWriteWins,
  MAX_CHUNK_BYTES,
  MAX_CHUNK_STATEMENTS,
  parseCursor,
  pullDecision,
  pushDecision,
  tombstone,
  type SyncRecord,
} from "./sync.js";

const rec = (id: string, updatedAt: string, deletedAt: string | null = null): SyncRecord => ({
  kind: "lick",
  id,
  ownerId: "u1",
  updatedAt,
  deletedAt,
  payload: { n: id.length },
});

const stampArb = () => fc.integer({ min: 0, max: 4000000000 }).map((s) => new Date(s * 1000).toISOString());

describe("sync.lastWriteWins", () => {
  it("newer wins regardless of argument order; ties keep local", () => {
    const a = rec("a", "2026-01-01T00:00:00.000Z");
    const b = rec("b", "2026-06-01T00:00:00.000Z");
    expect(lastWriteWins(a, b).updatedAt).toBe(b.updatedAt);
    expect(lastWriteWins(b, a).updatedAt).toBe(b.updatedAt);
    expect(lastWriteWins(a, a)).toBe(a);
  });
  it("property: LWW is commutative and idempotent", () => {
    fc.assert(
      fc.property(stampArb(), stampArb(), (t1, t2) => {
        const x = { updatedAt: t1, v: "x" };
        const y = { updatedAt: t2, v: "y" };
        expect(lastWriteWins(x, y).updatedAt).toBe(lastWriteWins(y, x).updatedAt);
        expect(lastWriteWins(x, x)).toBe(x);
      }),
    );
  });
  it("property: merging a set in any order converges to the same record", () => {
    fc.assert(
      fc.property(fc.array(stampArb(), { minLength: 1, maxLength: 8 }), (stamps) => {
        const items = stamps.map((t, i) => ({ updatedAt: t, id: `r${i}` }));
        const fold = (arr: { updatedAt: string; id: string }[]): string =>
          arr.reduce((acc, cur) => lastWriteWins(acc, cur)).updatedAt;
        expect(fold(items)).toBe(fold([...items].reverse()));
      }),
    );
  });
});

describe("sync.pushDecision / pullDecision", () => {
  it("nothing to push when the server copy is newer or equal", () => {
    const server = rec("a", "2026-06-01T00:00:00.000Z");
    expect(pushDecision(rec("a", "2026-01-01T00:00:00.000Z"), server)).toBeNull();
    expect(pushDecision(server, server)).toBeNull();
    expect(pushDecision(null, server)).toBeNull();
  });
  it("local newer gets pushed, including tombstones", () => {
    const dead = tombstone(rec("a", "2026-01-01T00:00:00.000Z"), "2026-07-01T00:00:00.000Z");
    expect(isTombstone(dead)).toBe(true);
    const out = pushDecision(dead, rec("a", "2026-01-01T00:00:00.000Z"));
    expect(out?.deletedAt).toBe("2026-07-01T00:00:00.000Z");
  });
  it("property: exactly one side wins (no both-push-both-pull loops)", () => {
    fc.assert(
      fc.property(stampArb(), stampArb(), (tLocal, tServer) => {
        const local = rec("a", tLocal);
        const server = rec("a", tServer);
        const shouldPush = pushDecision(local, server) !== null;
        const shouldPull = pullDecision(local, server);
        // Never both: that would ping-pong forever.
        expect(shouldPush && shouldPull).toBe(false);
        // And never neither, unless the timestamps are identical (already in sync).
        if (tLocal !== tServer) expect(shouldPush || shouldPull).toBe(true);
      }),
    );
  });
});

describe("sync.chunkRecords", () => {
  it("respects the statement cap", () => {
    const many = Array.from({ length: 130 }, (_, i) => rec(`id-${i}`, "2026-01-01T00:00:00.000Z"));
    const chunks = chunkRecords(many);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_STATEMENTS);
    expect(chunks.flat()).toHaveLength(130);
  });
  it("respects the byte cap with fat payloads", () => {
    const fat: SyncRecord[] = Array.from({ length: 10 }, (_, i) => ({
      kind: "lick",
      id: `f${i}`,
      ownerId: "u1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      payload: { blob: "x".repeat(20_000) },
    }));
    for (const c of chunkRecords(fat)) {
      expect(JSON.stringify(c).length).toBeLessThanOrEqual(MAX_CHUNK_BYTES + 40_000);
    }
  });
  it("empty input, no chunks; single record, single chunk", () => {
    expect(chunkRecords([])).toEqual([]);
    expect(chunkRecords([rec("a", "2026-01-01T00:00:00.000Z")])).toHaveLength(1);
  });
});

describe("sync cursors", () => {
  it("defaults to epoch and rejects garbage", () => {
    expect(parseCursor(null)).toBe("1970-01-01T00:00:00.000Z");
    expect(parseCursor("")).toBe("1970-01-01T00:00:00.000Z");
    expect(() => parseCursor("yesterday")).toThrow();
  });
  it("returns only newer changes, tombstones included, ordered", () => {
    const records = [
      rec("a", "2026-01-01T00:00:00.000Z"),
      rec("b", "2026-05-01T00:00:00.000Z"),
      rec("c", "2026-03-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z"),
    ];
    const out = changesSince(records, "2026-02-01T00:00:00.000Z");
    expect(out.map((r) => r.id)).toEqual(["c", "b"]);
    expect(out[0]!.deletedAt).not.toBeNull();
  });
  it("property: a cursor at the newest timestamp yields no further changes", () => {
    fc.assert(
      fc.property(fc.array(stampArb(), { minLength: 1, maxLength: 10 }), (stamps) => {
        const records = stamps.map((t, i) => rec(`r${i}`, t));
        const newest = records.map((r) => r.updatedAt).sort().at(-1)!;
        expect(changesSince(records, newest)).toHaveLength(0);
      }),
    );
  });
});
