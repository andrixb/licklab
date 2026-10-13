// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/sync: local-first sync rules. Dexie is UI source of truth; D1 is a
// synced copy. Conflict rule is last-write-wins PER RECORD (never per field),
// deletes propagate as tombstones, and pushes are chunked to stay inside the
// D1 free-tier caps (<=50 statements / invocation, <=100 bound params / query).
// Pure: no Dexie, no fetch, no DOM.

export const SYNC_SCHEMA_VERSION = 1;

/** Record kinds that sync. Public licks do NOT sync wholesale (fetched on demand). */
export const SYNC_KINDS = ["lick", "progression", "favorite", "pack"] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

export interface SyncRecord<T = unknown> {
  readonly kind: SyncKind;
  readonly id: string;
  readonly ownerId: string;
  readonly updatedAt: string;
  /** ISO date of soft delete, or null for a live record. */
  readonly deletedAt: string | null;
  readonly payload: T;
}

/**
 * Last-write-wins per record. ISO-8601 UTC strings sort lexicographically, so
 * a string compare is a timestamp compare; ties keep `local` (no churn when
 * nothing actually changed, and it makes the merge commutative on equal data).
 */
export function lastWriteWins<T extends { updatedAt: string }>(local: T, remote: T): T {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/** A tombstone: record deleted at `deletedAt`, still synced so peers remove it. */
export function tombstone<T extends { updatedAt: string }>(record: T, deletedAt: string): T & { deletedAt: string } {
  return { ...record, deletedAt, updatedAt: deletedAt };
}

export function isTombstone(record: { deletedAt: string | null }): boolean {
  return record.deletedAt !== null;
}

/**
 * Decide what a device should send for one record pair (local vs server copy).
 * Returns the record to push, or null when nothing needs sending (server wins
 * or is already equal) — that keeps writes and rows-written to D1 minimal.
 */
export function pushDecision<M extends { updatedAt: string }>(
  local: (M & { deletedAt: string | null }) | null,
  server: (M & { deletedAt: string | null }) | null,
): M & { deletedAt: string | null } | null {
  if (local === null) return null;
  if (server === null) return local;
  return lastWriteWins(server, local) === local && local.updatedAt > server.updatedAt ? local : null;
}

/**
 * Decide whether a pulled server record should overwrite the local copy.
 * Local wins ties (mirrors pushDecision), so a device never rewrites rows
 * that are already up to date.
 */
export function pullDecision<M extends { updatedAt: string }>(
  local: (M & { deletedAt: string | null }) | null,
  server: M & { deletedAt: string | null },
): boolean {
  if (local === null) return true;
  return server.updatedAt > local.updatedAt;
}

// ---- Chunking (D1 free-tier caps) ----

/** D1 allows 50 statements / invocation; leave headroom for reads + tombstone checks. */
export const MAX_CHUNK_STATEMENTS = 40;
/** D1 binds at most 100 params / query; chunking keeps one row per statement well under. */
export const MAX_CHUNK_BYTES = 64 * 1024;

/**
 * Split records into push chunks bounded by statement count AND serialized
 * size, so no request exceeds a Worker body/CPU budget.
 */
export function chunkRecords<T extends SyncRecord>(records: readonly T[]): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const r of records) {
    const size = JSON.stringify(r).length;
    if (current.length >= MAX_CHUNK_STATEMENTS || bytes + size > MAX_CHUNK_BYTES) {
      if (current.length > 0) chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(r);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ---- Cursors ----

export interface SyncCursor {
  readonly since: string;
}

/** Cursors are ISO UTC timestamps; reject anything unparseable (client-supplied). */
export function parseCursor(raw: string | null | undefined): string {
  if (!raw) return "1970-01-01T00:00:00.000Z";
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw new Error("invalid sync cursor");
  return new Date(ms).toISOString();
}

/**
 * Records changed at or after the cursor. Tombstones ARE included — they are
 * how deletes reach other devices. Sort makes the cursor monotonic for clients.
 */
export function changesSince<T extends SyncRecord>(records: readonly T[], since: string): T[] {
  return records.filter((r) => r.updatedAt > since).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
}