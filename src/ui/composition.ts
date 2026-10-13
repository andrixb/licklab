// ui/composition: the ONLY file in ui/ allowed to import adapters.
// Composition root: wires concrete adapters to application use cases and hands
// components plain use-case closures. Everything else in ui/ imports this
// module (or application/domain) — never adapters directly.

import { DexieLickRepository, LickLabDb } from "../adapters/dexie/licks.js";
import { VerovioRenderer } from "../adapters/notation/verovio.js";
import { deleteLick, listLicks, saveLick, type SaveLickInput } from "../application/licks.js";
import { SEED_LICKS } from "../application/seeds.js";
import type { LickFilter } from "../application/ports.js";
import type { Lick } from "../domain/lick.js";

/** Signed-out local-only mode namespace (M4 attaches namespaces to accounts). */
export const LOCAL_OWNER = "local";

const db = new LickLabDb(LOCAL_OWNER);
const repo = new DexieLickRepository(db);
const renderer = new VerovioRenderer();
const clock = { nowIso: (): string => new Date().toISOString() };
const ids = { next: (): string => crypto.randomUUID() };

export const lickLab = {
  listLicks: (filter?: LickFilter): Promise<Lick[]> => listLicks({ repo }, LOCAL_OWNER, filter),
  getLick: (id: string) => repo.get(id, LOCAL_OWNER),
  createLick: (input: SaveLickInput): Promise<Lick> => saveLick({ repo, clock, ids }, LOCAL_OWNER, input),
  removeLick: (id: string): Promise<void> => deleteLick({ repo, clock }, LOCAL_OWNER, id),
  renderNotation: (abc: string, opts?: { title?: string }): Promise<string> => renderer.renderAbcToSvg(abc, opts),
  ensureSeeded: async (): Promise<void> => {
    if ((await repo.list(LOCAL_OWNER)).length > 0) return;
    let n = 0;
    for (const seed of SEED_LICKS) {
      n += 1;
      await saveLick({ repo, clock, ids: { next: () => `seed-${n}` } }, LOCAL_OWNER, seed);
    }
  },
};
