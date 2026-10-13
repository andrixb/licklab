// Shared port-contract suite (not a test file itself — no .test. suffix).
// Runs against Memory (fake) and Dexie (real, fake-indexeddb in node).
import { describe, expect, it } from "vitest";
import { parseLick, type Lick } from "../../src/domain/lick.js";
import type { LickRepository } from "../../src/application/ports.js";

export function sampleLick(id: string, owner: string, extra: Partial<Lick> = {}): Lick {
  return parseLick({
    id,
    title: `Lick ${id}`,
    pattern: [{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 2 }],
    harmonicContext: { chords: [{ symbol: "C7", beats: 4 }], originalKey: "C", function: "dom7" },
    source: { artist: "Bird", instrument: "alto", track: "", album: "", year: null, recordingUrl: "", timestampSeconds: null, location: "" },
    tags: ["blues"],
    difficulty: 2,
    notes: "centuries of feeling",
    ownerId: owner,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    schemaVersion: 1,
    ...extra,
  });
}

export function lickRepositoryContract(name: string, create: () => LickRepository): void {
  describe(`LickRepository contract: ${name}`, () => {
    it("saves, gets, and isolates owners", async () => {
      const repo = create();
      await repo.save(sampleLick("a", "u1"));
      await repo.save(sampleLick("a", "u2"));
      expect((await repo.get("a", "u1"))?.title).toBe("Lick a");
      expect((await repo.get("a", "u2"))?.ownerId).toBe("u2");
      expect(await repo.get("missing", "u1")).toBeNull();
      expect(await repo.get("a", "u3")).toBeNull();
    });
    it("filters by function/artist/tag/difficulty/search", async () => {
      const repo = create();
      await repo.save(sampleLick("a", "u1"));
      await repo.save(
        sampleLick("b", "u1", {
          harmonicContext: { chords: [{ symbol: "Dm7", beats: 4 }], originalKey: "C", function: "ii-V-I major" },
          tags: [],
        }),
      );
      expect(await repo.list("u1", { function: "dom7" })).toHaveLength(1);
      expect(await repo.list("u1", { tag: "blues" })).toHaveLength(1);
      expect(await repo.list("u1", { difficulty: 2 })).toHaveLength(2);
      expect(await repo.list("u1", { search: "lick b" })).toHaveLength(1);
      expect(await repo.list("u2")).toHaveLength(0);
    });
    it("soft-deletes (tombstone kept, hidden by default)", async () => {
      const repo = create();
      await repo.save(sampleLick("a", "u1"));
      await repo.softDelete("a", "u1", "2026-02-01T00:00:00.000Z");
      expect(await repo.list("u1")).toHaveLength(0);
      const withDeleted = await repo.list("u1", { includeDeleted: true });
      expect(withDeleted).toHaveLength(1);
      expect(withDeleted[0]?.deletedAt).toBe("2026-02-01T00:00:00.000Z");
    });
  });
}
