// adapters/memory: in-memory LickRepository. Test fake + predictable seed host.
// Contract tests run the same suite against this and Dexie.

import type { Lick } from "../../domain/lick.js";
import type { LickFilter, LickRepository } from "../../application/ports.js";

export class MemoryLickRepository implements LickRepository {
  private readonly store = new Map<string, Lick>();
  async save(lick: Lick): Promise<void> {
    this.store.set(`${lick.ownerId}:${lick.id}`, structuredClone(lick));
  }
  async get(id: string, ownerId: string): Promise<Lick | null> {
    return this.store.get(`${ownerId}:${id}`) ?? null;
  }
  async list(ownerId: string, filter?: LickFilter): Promise<Lick[]> {
    return [...this.store.values()].filter((l) => {
      if (l.ownerId !== ownerId) return false;
      if (!filter?.includeDeleted && l.deletedAt) return false;
      if (filter?.function && l.harmonicContext.function !== filter.function) return false;
      if (filter?.artist && l.source.artist !== filter.artist) return false;
      if (filter?.difficulty !== undefined && l.difficulty !== filter.difficulty) return false;
      if (filter?.tag && !l.tags.includes(filter.tag)) return false;
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        const hay = `${l.title} ${l.source.artist} ${l.notes} ${l.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  async softDelete(id: string, ownerId: string, deletedAt: string): Promise<void> {
    const l = this.store.get(`${ownerId}:${id}`);
    if (l) this.store.set(`${ownerId}:${id}`, { ...l, deletedAt, updatedAt: deletedAt });
  }
}
