// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/d1/lick: D1-backed LickRepository for the community catalog.
// Implements the LickRepository port + PublicLickCatalog port.
// Uses batched queries, statement-count limits, and Cache API for public reads.

import { parseLick, type Lick } from "../../domain/lick.js";
import type { LickRepository, PublicLickCatalog } from "../../application/ports.js";
import type { D1Like } from "../../worker/d1-dialect.js";

export interface LickRow {
  readonly id: string;
  readonly owner_id: string;
  readonly title: string;
  readonly pattern: string;
  readonly harmonic_context: string;
  readonly context_key: string;
  readonly function_key: string;
  readonly chord_quality: string | null;
  readonly pattern_hash: string;
  readonly visibility: string;
  readonly license: string;
  readonly moderation_state: string;
  readonly source_artist: string | null;
  readonly source_instrument: string | null;
  readonly source_track: string | null;
  readonly source_album: string | null;
  readonly source_year: number | null;
  readonly source_recording_url: string | null;
  readonly source_timestamp_seconds: number | null;
  readonly source_location: string | null;
  readonly tags: string;
  readonly difficulty: number;
  readonly notes: string;
  readonly likes: number;
  readonly created_at: number;
  readonly updated_at: number;
  readonly deleted_at: number | null;
  readonly schema_version: number;
}

function toRow(lick: Lick): Record<string, unknown> {
  return {
    id: lick.id,
    owner_id: lick.ownerId,
    title: lick.title,
    pattern: JSON.stringify(lick.pattern),
    harmonic_context: JSON.stringify(lick.harmonicContext),
    context_key: lick.contextKey,
    function_key: lick.functionKey,
    chord_quality: lick.chordQuality,
    pattern_hash: lick.patternHash,
    visibility: lick.visibility,
    license: lick.license,
    moderation_state: lick.moderationState,
    source_artist: lick.source.artist,
    source_instrument: lick.source.instrument,
    source_track: lick.source.track,
    source_album: lick.source.album,
    source_year: lick.source.year,
    source_recording_url: lick.source.recordingUrl,
    source_timestamp_seconds: lick.source.timestampSeconds,
    source_location: lick.source.location,
    tags: JSON.stringify(lick.tags),
    difficulty: lick.difficulty,
    notes: lick.notes,
    likes: lick.likes,
    created_at: new Date(lick.createdAt).getTime(),
    updated_at: new Date(lick.updatedAt).getTime(),
    deleted_at: lick.deletedAt ? new Date(lick.deletedAt).getTime() : null,
    schema_version: lick.schemaVersion,
  };
}

function fromRow(row: LickRow): Lick {
  return parseLick({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    pattern: JSON.parse(row.pattern),
    harmonicContext: JSON.parse(row.harmonic_context),
    contextKey: row.context_key,
    functionKey: row.function_key,
    chordQuality: row.chord_quality,
    patternHash: row.pattern_hash,
    visibility: row.visibility,
    license: row.license,
    moderationState: row.moderation_state,
    source: {
      artist: row.source_artist ?? "",
      instrument: row.source_instrument ?? "",
      track: row.source_track ?? "",
      album: row.source_album ?? "",
      year: row.source_year,
      recordingUrl: row.source_recording_url ?? "",
      timestampSeconds: row.source_timestamp_seconds,
      location: row.source_location ?? "",
    },
    tags: JSON.parse(row.tags),
    difficulty: row.difficulty,
    notes: row.notes,
    likes: row.likes,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    schemaVersion: row.schema_version,
  });
}

export class D1LickRepository implements LickRepository {
  constructor(private readonly db: D1Like) {}

  async save(lick: Lick): Promise<void> {
    const row = toRow(lick);
    const cols = Object.keys(row).join(", ");
    const placeholders = Object.keys(row).map(() => "?").join(", ");
    const values = Object.values(row);
    await this.db.prepare(
      `INSERT INTO lick (${cols}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${Object.keys(row)
        .filter((k) => k !== "id")
        .map((k) => `${k} = excluded.${k}`)
        .join(", ")}`
    ).bind(...values).run();
  }

  async get(id: string, ownerId: string): Promise<Lick | null> {
    const row = await this.db.prepare("SELECT * FROM lick WHERE id = ? AND owner_id = ?")
      .bind(id, ownerId).first<LickRow>();
    if (!row || row.owner_id !== ownerId) return null;
    return fromRow(row);
  }

  async list(ownerId: string, filter?: { function?: string; artist?: string; tag?: string; difficulty?: number; search?: string; includeDeleted?: boolean }): Promise<Lick[]> {
    let sql = "SELECT * FROM lick WHERE owner_id = ?";
    const params: unknown[] = [ownerId];

    if (!filter?.includeDeleted) {
      sql += " AND deleted_at IS NULL";
    }
    if (filter?.function) {
      sql += " AND function_key = ?";
      params.push(filter.function);
    }
    if (filter?.artist) {
      sql += " AND source_artist = ?";
      params.push(filter.artist);
    }
    if (filter?.difficulty !== undefined) {
      sql += " AND difficulty = ?";
      params.push(filter.difficulty);
    }
    if (filter?.tag) {
      sql += " AND id IN (SELECT lick_id FROM lick_tag WHERE tag_id = ?)";
      params.push(filter.tag.toLowerCase());
    }
    if (filter?.search) {
      sql += " AND (title LIKE ? OR source_artist LIKE ? OR notes LIKE ?)";
      const term = `%${filter.search.toLowerCase()}%`;
      params.push(term, term, term);
    }
    sql += " ORDER BY updated_at DESC";

    const rows = await this.db.prepare(sql).bind(...params).all<LickRow>();
    return (rows.results ?? []).map(fromRow);
  }

  async softDelete(id: string, ownerId: string, deletedAt: string): Promise<void> {
    await this.db.prepare("UPDATE lick SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .bind(deletedAt, deletedAt, id, ownerId).run();
  }
}

export class D1PublicLickCatalog implements PublicLickCatalog {
  constructor(private readonly db: D1Like) {}

  async fetchPublicLicks(): Promise<{ lick: Lick; likes: number }[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM lick
      WHERE visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL
      ORDER BY created_at DESC
    `).bind().all() as { results: LickRow[] };

    return results.map((row: LickRow) => ({
      lick: fromRow(row),
      likes: row.likes,
    }));
  }

  async fetchBySignatures(signatures: string[]): Promise<{ lick: Lick; likes: number }[]> {
    if (signatures.length === 0) return [];
    const placeholders = signatures.map(() => "?").join(",");
    const { results } = await this.db.prepare(`
      SELECT * FROM lick
      WHERE visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL
      AND context_key IN (${placeholders})
      ORDER BY likes DESC, updated_at DESC
    `).bind(...signatures).all() as { results: LickRow[] };

    return results.map((row: LickRow) => ({
      lick: fromRow(row),
      likes: row.likes,
    }));
  }

  async fetchByIds(ids: string[]): Promise<{ lick: Lick; likes: number }[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await this.db.prepare(`
      SELECT * FROM lick
      WHERE id IN (${placeholders})
      AND visibility = 'public'
      AND moderation_state = 'approved'
      AND deleted_at IS NULL
    `).bind(...ids).all() as { results: LickRow[] };

    return results.map((row: LickRow) => ({
      lick: fromRow(row),
      likes: row.likes,
    }));
  }
}