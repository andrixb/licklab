// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/licks.test: use cases against an in-memory fake (contract tests
// against real adapters live in tests/unit/repository-contract.test.ts).
import { describe, expect, it } from "vitest";
import type { Lick } from "../domain/lick.js";
import { deleteLick, listLicks, saveLick } from "./licks.js";
import type { LickFilter } from "./ports.js";

function fakeRepo() {
  const store = new Map<string, Lick>();
  return {
    store,
    async save(lick: Lick): Promise<void> {
      store.set(`${lick.ownerId}:${lick.id}`, lick);
    },
    async get(id: string, ownerId: string): Promise<Lick | null> {
      return store.get(`${ownerId}:${id}`) ?? null;
    },
    async list(ownerId: string, filter?: LickFilter): Promise<Lick[]> {
      return [...store.values()].filter((l) => {
        if (l.ownerId !== ownerId) return false;
        if (!filter?.includeDeleted && l.deletedAt) return false;
        if (filter?.function && l.harmonicContext.function !== filter.function) return false;
        if (filter?.tag && !l.tags.includes(filter.tag)) return false;
        return true;
      });
    },
    async softDelete(id: string, ownerId: string, deletedAt: string): Promise<void> {
      const l = store.get(`${ownerId}:${id}`);
      if (l) store.set(`${ownerId}:${id}`, { ...l, deletedAt });
    },
  };
}

const deps = () => ({
  repo: fakeRepo(),
  clock: { nowIso: () => "2026-03-01T00:00:00.000Z" },
  ids: { next: () => "id-1" },
});

const input = {
  title: "Test lick",
  pattern: [{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 2 }],
  harmonicContext: {
    chords: [{ symbol: "C7", beats: 4 }],
    originalKey: "C",
    function: "dom7" as const,
  },
};

describe("saveLick", () => {
  it("validates, stamps, and stores", async () => {
    const d = deps();
    const lick = await saveLick(d, "owner-1", input);
    expect(lick.id).toBe("id-1");
    expect(lick.createdAt).toBe("2026-03-01T00:00:00.000Z");
    expect(await d.repo.get("id-1", "owner-1")).toEqual(lick);
  });
  it("rejects empty owner and invalid patterns", async () => {
    await expect(saveLick(deps(), "", input)).rejects.toThrow();
    await expect(saveLick(deps(), "o", { ...input, pattern: [] })).rejects.toThrow();
  });
});

describe("listLicks/deleteLick", () => {
  it("lists per owner, filters, soft-deletes", async () => {
    const d = deps();
    await saveLick(d, "owner-1", input);
    await saveLick({ ...d, ids: { next: () => "id-2" } }, "owner-2", input);
    expect(await listLicks(d, "owner-1")).toHaveLength(1);
    expect(await listLicks(d, "owner-1", { tag: "nope" })).toHaveLength(0);
    await deleteLick(d, "owner-1", "id-1");
    expect(await listLicks(d, "owner-1")).toHaveLength(0);
    expect(d.repo.store.get("owner-1:id-1")?.deletedAt).toBe("2026-03-01T00:00:00.000Z");
    await expect(deleteLick(d, "owner-1", "missing")).rejects.toThrow();
  });
});
