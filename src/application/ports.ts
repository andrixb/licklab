// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application ports (interfaces owned by the application layer).
// Full list per spec; implementations live in adapters/ or worker/.
// UI talks to use cases; use cases talk to these ports; never to adapters directly.

import type { Lick } from "../domain/lick.js";
import type { Song } from "../domain/song.js";
import type { CatalogLick } from "../domain/matching.js";
import type { BandEvent, BandPart, BandStyle, TimedEvent } from "../domain/band.js";
import type { FlatChord } from "../domain/progression.js";

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
/** Comping piano voice: sampled upright, or DX7-style FM electric piano. */
export type PianoVoice = "upright" | "dx7";

/** Voice variants for different sound palettes (JMove-style). */
export type BassVariant = "upright" | "acoustic" | "electric";
export type PianoVariant = "upright" | "dx7" | "electric_piano" | "grand_piano";
export type DrumVariant = "jazz" | "machine";

/** Per-voice level multipliers (0..1.5); absent voices default to 1. */
export interface BandLevels {
  readonly bass?: number;
  readonly piano?: number;
  readonly drums?: number;
  readonly lick?: number;
}
export interface BandPlayOpts {
  readonly levels?: BandLevels;
  /** Seamless Transport loop over the chorus (finished resolves on stop). */
  readonly loop?: boolean;
}
export interface AudioEngine {
  /** User-gesture unlock (Tone.start) — safe to call repeatedly. */
  unlock(): Promise<void>;
  play(events: readonly TimedEvent[], totalSeconds: number, gainDb?: number, opts?: BandPlayOpts): BandPlayback;
  /** True only while audio is actually being produced (never during loading). */
  readonly isPlaying: boolean;
  /** Transport position in seconds (for playhead display; 0 when idle). */
  getPositionSeconds(): number;
  /** Select the comping piano voice (default "upright"). */
  setPianoVoice(voice: PianoVoice): void;
  /** Select the bass sound variant (default "upright"). */
  setBassVariant(variant: BassVariant): Promise<void>;
  /** Select the piano sound variant (default "upright"). */
  setPianoVariant(variant: PianoVariant): Promise<void>;
  /** Select the drum kit variant (default "jazz"). */
  setDrumVariant(variant: DrumVariant): Promise<void>;
  /** Report missing/failed samples so the UI can say so instead of silent play. */
  readonly lastError: string | null;
}
/**
 * Pattern source for the band: turns chords into beat-grid events. The local
 * domain engine and the lazy jmove adapter both implement this; use cases
 * stay engine-agnostic and the UI never imports adapters directly.
 */
export interface BandGenerateOptions {
  readonly seed?: number;
  readonly density?: number;
  readonly swingAmount?: number;
  readonly strumMs?: number;
  readonly creativity?: number;
  readonly conversation?: number;
  readonly airGaps?: number;
  readonly harmonicFreedom?: number;
  readonly drumComplexity?: number;
  readonly pianoComplexity?: number;
  readonly bassComplexity?: number;
}
export interface BandPatternProvider {
  readonly name: string;
  generateBand(
    flat: readonly FlatChord[],
    style: BandStyle,
    part: BandPart,
    tempoBpm: number,
    opts?: BandGenerateOptions,
  ): Promise<readonly BandEvent[]>;
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
