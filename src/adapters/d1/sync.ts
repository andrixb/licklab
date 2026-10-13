// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/d1/sync: the D1 side of local-first sync. One batched write per
// push request (D1 cap: 50 statements / invocation) and a single indexed read
// per changes request. Owner scoping is enforced here, not just in the route.

import { parseLick } from "../../domain/lick.js";
import { parseProgressionInput, type ProgressionBar } from "../../domain/progression.js";
import type { SyncKind, SyncRecord } from "../../domain/sync.js";
import type { D1Like } from "../../worker/d1-dialect.js";

const toMs = (iso: string): number => Date.parse(iso);
const toIso = (ms: number | null): string | null => (ms == null ? null : new Date(ms).toISOString());

interface Row {
  id: string;
  owner_id: string;
  updated_at: number;
  deleted_at: number | null;
}

/** Which table + how to serialize the payload for each syncable kind. */
const TABLE: Record<SyncKind, string> = {
  lick: "lick",
  progression: "progression",
  favorite: "favorite",
  pack: "pack",
};

/** Validate the incoming payload against the domain before it touches D1. */
export function validatePayload(kind: SyncKind, payload: unknown): { ok: true } | { ok: false; error: string } {
  if (kind === "lick") {
    try {
      parseLick(payload);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "invalid lick" };
    }
  }
  if (kind === "progression") {
    const p = payload as { bars?: unknown; title?: unknown; key?: unknown };
    if (!Array.isArray(p?.bars) || p.bars.length === 0) return { ok: false, error: "progression.bars required" };
    try {
      // Reuse the typed parser on a flat rendering to validate chord symbols.
      const bars = p.bars as { chords?: { symbol?: string; beats?: number }[] }[];
      const flat = bars
        .flatMap((b: { chords?: { symbol?: string }[] }) => (b.chords ?? []).map((c: { symbol?: string }) => c.symbol ?? ""))
        .filter(Boolean);
      if (flat.length === 0) return { ok: false, error: "progression has no chords" };
      parseProgressionInput(flat.join(" "));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "invalid progression" };
    }
  }
  return { ok: true };
}

export class D1SyncRepository {
  constructor(private readonly db: D1Like) {}

  /** Current server timestamps for a batch of (kind,id) owned by `ownerId`. */
  async serverStamps(records: readonly SyncRecord[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    // One cheap query per kind (<=4), owner-scoped, so we never exceed the
    // statement budget while still resolving LWW per record.
    const byKind = new Map<SyncKind, string[]>();
    for (const r of records) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.id]);
    for (const [kind, ids] of byKind) {
      const unique = [...new Set(ids)].slice(0, 90);
      if (unique.length === 0) continue;
      const placeholders = unique.map(() => "?").join(",");
      const rows = (await this.db
        .prepare(`SELECT id, updated_at FROM ${TABLE[kind]} WHERE owner_id = ? AND id IN (${placeholders})`)
        .bind(records.find((r) => r.kind === kind)?.ownerId ?? "", ...unique)
        .all()) as { results: Row[] };
      for (const row of rows.results ?? []) map.set(`${kind}:${row.id}`, new Date(row.updated_at).toISOString());
    }
    return map;
  }

  /** Apply a batch of already-LWW-resolved records as one D1 transaction. */
  async apply(records: readonly SyncRecord[]): Promise<{ written: number; conflicts: { index: number; error: string }[] }> {
    const conflicts: { index: number; error: string }[] = [];
    const statements: unknown[] = [];
    for (const r of records) {
      const updatedAt = toMs(r.updatedAt);
      const deletedAt = r.deletedAt === null ? null : toMs(r.deletedAt);
      if (r.kind === "lick") {
        const lick = parseLick(r.payload);
        // Check for cross-user ID conflict: same ID, different owner
        const existing = await this.db
          .prepare("SELECT owner_id FROM lick WHERE id = ?")
          .bind(r.id)
          .first<{ owner_id: string }>();
        if (existing && existing.owner_id !== r.ownerId) {
          conflicts.push({ index: records.indexOf(r), error: "id already exists with different owner" });
          continue;
        }
        statements.push(
          this.db
            .prepare(
              `INSERT INTO lick (id, owner_id, title, pattern, harmonic_context, context_key, function_key,
                 chord_quality, pattern_hash, visibility, license, moderation_state, source_artist,
                 source_instrument, source_track, source_album, source_year, source_recording_url,
                 source_timestamp_seconds, source_location, tags, difficulty, notes, likes,
                 created_at, updated_at, deleted_at, schema_version)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(id, owner_id) DO UPDATE SET title=excluded.title, pattern=excluded.pattern,
                     harmonic_context=excluded.harmonic_context, context_key=excluded.context_key,
                     function_key=excluded.function_key, chord_quality=excluded.chord_quality,
                     pattern_hash=excluded.pattern_hash, visibility=excluded.visibility,
                     license=excluded.license, moderation_state=excluded.moderation_state,
                     tags=excluded.tags, difficulty=excluded.difficulty, notes=excluded.notes,
                     updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
            )
            .bind(
              lick.id,
              r.ownerId,
              lick.title,
              JSON.stringify(lick.pattern),
              JSON.stringify(lick.harmonicContext),
              lick.contextKey,
              lick.functionKey,
              lick.chordQuality,
              lick.patternHash,
              lick.visibility,
              lick.license,
              lick.moderationState,
              lick.source.artist,
              lick.source.instrument,
              lick.source.track,
              lick.source.album,
              lick.source.year,
              lick.source.recordingUrl,
              lick.source.timestampSeconds,
              lick.source.location,
              JSON.stringify(lick.tags),
              lick.difficulty,
              lick.notes,
              lick.likes,
              updatedAt,
              updatedAt,
              deletedAt,
              lick.schemaVersion,
            ),
        );
      } else if (r.kind === "progression") {
        const p = r.payload as {
          id?: string;
          title?: string;
          key?: string;
          bars?: ProgressionBar[];
          composer?: string;
          externalUrl?: string;
          origin?: string;
        };
        statements.push(
          this.db
            .prepare(
              `INSERT INTO progression (id, owner_id, title, composer, key, form, external_url, origin,
                 created_at, updated_at, deleted_at, schema_version)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
               ON CONFLICT(id) DO UPDATE SET title=excluded.title, key=excluded.key,
                 form=excluded.form, origin=excluded.origin, updated_at=excluded.updated_at,
                 deleted_at=excluded.deleted_at`,
            )
            .bind(
              r.id,
              r.ownerId,
              p.title ?? "",
              p.composer ?? "",
              p.key ?? "",
              JSON.stringify(p.bars ?? []),
              p.externalUrl ?? "",
              p.origin ?? "typed",
              updatedAt,
              updatedAt,
              deletedAt,
            ),
        );
      } else if (r.kind === "favorite") {
        const f = r.payload as { lickId?: string };
        const lickId = f.lickId ?? r.id;
        if (deletedAt === null) {
          statements.push(
            this.db
              .prepare(`INSERT INTO favorite (id, user_id, lick_id, created_at) VALUES (?,?,?,?)
                        ON CONFLICT(user_id, lick_id) DO NOTHING`)
              .bind(r.id, r.ownerId, lickId, updatedAt),
          );
        } else {
          statements.push(
            this.db.prepare("DELETE FROM favorite WHERE id = ? AND user_id = ?").bind(r.id, r.ownerId),
          );
        }
      } else {
        const pack = r.payload as { title?: string; description?: string; visibility?: string; shortId?: string };
        statements.push(
          this.db
            .prepare(
              `INSERT INTO pack (id, owner_id, title, description, visibility, short_id, created_at, updated_at, deleted_at)
               VALUES (?,?,?,?,?,?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
                 visibility=excluded.visibility, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
            )
            .bind(
              r.id,
              r.ownerId,
              pack.title ?? "",
              pack.description ?? "",
              pack.visibility ?? "private",
              pack.shortId ?? r.id.slice(0, 8),
              updatedAt,
              updatedAt,
              deletedAt,
            ),
        );
      }
    }
    if (statements.length === 0) return { written: 0, conflicts: [] };
    await (this.db as unknown as { batch(stmts: unknown[]): Promise<unknown> }).batch(statements);
    return { written: statements.length, conflicts };
  }

  /** Everything owned by `ownerId` that changed after `since`, tombstones included. */
  async changesSince(ownerId: string, since: string): Promise<SyncRecord[]> {
    const sinceMs = toMs(since);
    const out: SyncRecord[] = [];

    const licks = (await this.db
      .prepare("SELECT * FROM lick WHERE owner_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 500")
      .bind(ownerId, sinceMs)
      .all()) as { results: (Row & Record<string, unknown>)[] };
    for (const row of licks.results ?? []) {
      out.push({
        kind: "lick",
        id: row.id,
        ownerId,
        updatedAt: toIso(row.updated_at) as string,
        deletedAt: toIso(row.deleted_at as number | null),
        payload: rebuildLick(row),
      });
    }

    const progs = (await this.db
      .prepare("SELECT * FROM progression WHERE owner_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 500")
      .bind(ownerId, sinceMs)
      .all()) as { results: (Row & Record<string, unknown>)[] };
    for (const row of progs.results ?? []) {
      out.push({
        kind: "progression",
        id: row.id,
        ownerId,
        updatedAt: toIso(row.updated_at) as string,
        deletedAt: toIso(row.deleted_at as number | null),
        payload: {
          title: row.title,
          key: row.key,
          composer: row.composer,
          externalUrl: row.external_url,
          origin: row.origin,
          bars: JSON.parse((row.form as string) ?? "[]"),
        },
      });
    }

    const favs = (await this.db
      .prepare("SELECT id, lick_id, created_at FROM favorite WHERE user_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 500")
      .bind(ownerId, sinceMs)
      .all()) as { results: { id: string; lick_id: string; created_at: number }[] };
    for (const row of favs.results ?? []) {
      out.push({
        kind: "favorite",
        id: row.id,
        ownerId,
        updatedAt: toIso(row.created_at) as string,
        deletedAt: null,
        payload: { lickId: row.lick_id },
      });
    }

    const packs = (await this.db
      .prepare("SELECT * FROM pack WHERE owner_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 500")
      .bind(ownerId, sinceMs)
      .all()) as { results: (Row & Record<string, unknown>)[] };
    for (const row of packs.results ?? []) {
      out.push({
        kind: "pack",
        id: row.id,
        ownerId,
        updatedAt: toIso(row.updated_at) as string,
        deletedAt: toIso(row.deleted_at as number | null),
        payload: {
          title: row.title,
          description: row.description,
          visibility: row.visibility,
          shortId: row.short_id,
        },
      });
    }

    return out.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  }
}

/** Rebuild a domain Lick from a D1 row (parseLick re-derives signatures). */
function rebuildLick(row: Record<string, unknown>): unknown {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    pattern: JSON.parse(row.pattern as string),
    harmonicContext: JSON.parse(row.harmonic_context as string),
    visibility: row.visibility,
    license: row.license,
    moderationState: row.moderation_state,
    likes: row.likes,
    source: {
      artist: (row.source_artist as string) ?? "",
      instrument: (row.source_instrument as string) ?? "",
      track: (row.source_track as string) ?? "",
      album: (row.source_album as string) ?? "",
      year: (row.source_year as number | null) ?? null,
      recordingUrl: (row.source_recording_url as string) ?? "",
      timestampSeconds: (row.source_timestamp_seconds as number | null) ?? null,
      location: (row.source_location as string) ?? "",
    },
    tags: JSON.parse((row.tags as string) ?? "[]"),
    difficulty: row.difficulty,
    notes: (row.notes as string) ?? "",
    createdAt: new Date(row.created_at as number).toISOString(),
    updatedAt: new Date(row.updated_at as number).toISOString(),
    deletedAt: row.deleted_at == null ? null : new Date(row.deleted_at as number).toISOString(),
    schemaVersion: 2,
  };
}
