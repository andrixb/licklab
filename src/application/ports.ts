// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application ports (interfaces owned by the application layer).
// Full list per spec; implementations live in adapters/ or worker/.
// UI talks to use cases; use cases talk to these ports; never to adapters directly.

import type { Lick } from "../domain/lick.js";
import type { Song } from "../domain/song.js";
import type { CatalogLick } from "../domain/matching.js";
import type { TimedEvent } from "../domain/band.js";

export interface LickFilter {
  readonly function?: string;
  readonly artist?: string;
  readonly tag?: string;
  readonly difficulty?: number;
  readonly search?: string; // matches title, artist, tags, notes
  readonly includeDeleted?: boolean;
}

export interface LickRepository {
  save(lick: Lick): Promise<void>;
  get(id: string, ownerId: string): Promise<Lick | null>;
  list(ownerId: string, filter?: LickFilter): Promise<Lick[]>;
  /** Soft delete (sets deletedAt); hard delete only via account deletion (M4). */
  softDelete(id: string, ownerId: string, deletedAt: string): Promise<void>;
}
export interface SongRepository {
  save(song: Song): Promise<void>;
  get(id: string, ownerId: string): Promise<Song | null>;
  list(ownerId: string): Promise<Song[]>;
}
export interface SyncRemote {
  pullChanges(since: string): Promise<unknown[]>;
  pushChanges(changes: unknown[]): Promise<void>;
}
/**
 * Anonymous read of public licks for matching. Implementations: static
 * starter pack (offline), D1-backed HTTP catalog (M4), local cache.
 * The UI/use cases never know which — they get CatalogLick[] (with likes).
 */
export interface PublicLickCatalog {
  fetchPublicLicks(): Promise<CatalogLick[]>;
}
export interface SessionVerifier {
  verify(request: Request): Promise<{ ownerId: string } | null>;
}
export interface RateLimiter {
  check(key: string): Promise<{ allowed: boolean }>;
}
/** Play a scheduled chorus; resolves when playback ENDS (or is stopped). */
export interface BandPlayback {
  stop(): void;
  finished: Promise<void>;
}
export interface AudioEngine {
  /** User-gesture unlock (Tone.start) — safe to call repeatedly. */
  unlock(): Promise<void>;
  play(events: readonly TimedEvent[], totalSeconds: number, gainDb?: number): BandPlayback;
  /** True only while audio is actually being produced (never during loading). */
  readonly isPlaying: boolean;
  /** Report missing/failed samples so the UI can say so instead of silent play. */
  readonly lastError: string | null;
}
export interface BackingProvider {
  readonly name: "backing-provider";
}
export interface NotationOptions {
  readonly title?: string;
  readonly scale?: number; // percent, default 40 (compact lead-sheet size)
}
export interface NotationRenderer {
  /** Render ABC input to SVG. Heavy WASM loads lazily on first call. */
  renderAbcToSvg(abc: string, opts?: NotationOptions): Promise<string>;
}
export interface MidiInput {
  readonly name: "midi-input";
}
export interface SongImporter {
  readonly name: "song-importer";
}
export interface Exporter {
  readonly name: "exporter";
}
export interface TimeStretchPlayer {
  readonly name: "time-stretch-player";
}
export interface YouTubeLoopPlayer {
  readonly name: "youtube-loop-player";
}
export interface Clock {
  nowIso(): string;
}
export interface IdGenerator {
  next(): string;
}
