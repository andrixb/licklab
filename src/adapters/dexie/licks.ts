// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/dexie: Dexie (IndexedDB) LickRepository. Local-first store, one
// database per namespace (per-user namespacing for shared devices; M4 attaches
// the namespace to the account). Soft deletes stay as tombstones for sync.

import { Dexie, type Table } from "dexie";
import { parseLick, type Lick } from "../../domain/lick.js";
import type { LickFilter, LickRepository } from "../../application/ports.js";

export interface LickRow {
  readonly id: string;
  readonly ownerId: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly function: string;
  readonly artist: string;
  readonly difficulty: number;
  readonly title: string;
  readonly data: string; // full Lick JSON (pattern + context live here)
}

export function toRow(lick: Lick): LickRow {
  return {
    id: lick.id,
    ownerId: lick.ownerId,
    updatedAt: lick.updatedAt,
    deletedAt: lick.deletedAt,
    function: lick.harmonicContext.function,
    artist: lick.source.artist,
    difficulty: lick.difficulty,
    title: lick.title,
    data: JSON.stringify(lick),
  };
}

export class LickLabDb extends Dexie {
  readonly licks!: Table<LickRow, string>;
  constructor(namespace: string) {
    super(`licklab-${namespace}`);
    this.version(1).stores({
      // Compound key; query by owner first (mirrors the D1 index rule).
      licks: "[ownerId+id], ownerId, updatedAt",
    });
  }
}

export class DexieLickRepository implements LickRepository {
  constructor(private readonly db: LickLabDb) {}
  async save(lick: Lick): Promise<void> {
    await this.db.licks.put(toRow(lick));
  }
  async get(id: string, ownerId: string): Promise<Lick | null> {
    const row = await this.db.licks.get([ownerId, id]);
    if (!row || row.ownerId !== ownerId) return null;
    return parseLick(JSON.parse(row.data as string));
  }
  async list(ownerId: string, filter?: LickFilter): Promise<Lick[]> {
    let rows = await this.db.licks.where("ownerId").equals(ownerId).toArray();
    if (!filter?.includeDeleted) rows = rows.filter((r) => r.deletedAt == null);
    if (filter?.function) rows = rows.filter((r) => r.function === filter.function);
    if (filter?.artist) rows = rows.filter((r) => r.artist === filter.artist);
    if (filter?.difficulty !== undefined) rows = rows.filter((r) => r.difficulty === filter.difficulty);
    if (filter?.tag) {
      const tag = filter.tag;
      rows = rows.filter((r) => (parseLick(JSON.parse(r.data as string)).tags as string[]).includes(tag));
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((r) => {
        const l = parseLick(JSON.parse(r.data as string));
        return l.title.toLowerCase().includes(q) || l.source.artist.toLowerCase().includes(q) || l.notes.toLowerCase().includes(q);
      });
    }
    return rows.map((r) => parseLick(JSON.parse(r.data as string)));
  }
  async softDelete(id: string, ownerId: string, deletedAt: string): Promise<void> {
    const row = await this.db.licks.get([ownerId, id]);
    if (!row || row.ownerId !== ownerId) return;
    const lick = { ...parseLick(JSON.parse(row.data as string)), deletedAt, updatedAt: deletedAt };
    await this.db.licks.put(toRow(lick));
  }
}
