import { describe, expect, it } from "vitest";
import { SEED_LICKS } from "../../src/application/seeds.js";
import { saveLick } from "../../src/application/licks.js";
import { MemoryLickRepository } from "../../src/adapters/memory/licks.js";

describe("seeds", () => {
  it("all seed licks validate and save", async () => {
    const repo = new MemoryLickRepository();
    let n = 0;
    for (const seed of SEED_LICKS) {
      const lick = await saveLick(
        { repo, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" }, ids: { next: () => `seed-${(n += 1)}` } },
        "local",
        seed,
      );
      expect(lick.id).toMatch(/^seed-/);
    }
    expect(await repo.list("local")).toHaveLength(SEED_LICKS.length);
  });
});
