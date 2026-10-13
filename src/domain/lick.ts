// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/lick: the Lick entity + validation. Pattern notes store degrees
// (diatonic steps + semitones) relative to the source chord root, so a lick
// transposes by re-rooting with correct spelling (see pitch.spellDegree).
// v2: derived key-independent signatures (contextKey/functionKey/chordQuality/
// patternHash) + visibility/license/moderation state. Signatures are computed
// here (single source of truth) from the parsed context; they are never taken
// from unvalidated input.

import type { ChordQuality } from "./chords.js";
import { parseChordSymbol } from "./chords.js";
import { patternHashOf, signaturesOf } from "./signatures.js";

export const LICK_SCHEMA_VERSION = 2;

export type Visibility = "private" | "unlisted" | "public";
export const VISIBILITIES: readonly Visibility[] = ["private", "unlisted", "public"];
export type ModerationState = "pending" | "approved" | "hidden";
export const MODERATION_STATES: readonly ModerationState[] = ["pending", "approved", "hidden"];
export const DEFAULT_LICENSE = "CC BY 4.0";

// Content limits (docs/domain.md): 8 bars, 64 notes, chord list bounded.
export const MAX_PATTERN_NOTES = 64;
export const MAX_CONTEXT_CHORDS = 16;

export type LickFunction =
  | "ii-V-I major"
  | "ii-V-i minor"
  | "dom7"
  | "turnaround"
  | "static major"
  | "static minor"
  | "blues"
  | "other";

export const LICK_FUNCTIONS: readonly LickFunction[] = [
  "ii-V-I major",
  "ii-V-i minor",
  "dom7",
  "turnaround",
  "static major",
  "static minor",
  "blues",
  "other",
];

export interface LickNote {
  /** Diatonic steps above the source chord root (0 = root). */
  readonly steps: number;
  /** Semitones above the source chord root. */
  readonly semitones: number;
  readonly octaveOffset: number;
  readonly startBeat: number;
  readonly durationBeats: number;
}

export interface LickChord {
  readonly symbol: string;
  readonly beats: number;
}

export interface LickSource {
  readonly artist: string;
  readonly instrument: string;
  readonly track: string;
  readonly album: string;
  readonly year: number | null;
  readonly recordingUrl: string;
  readonly timestampSeconds: number | null;
  readonly location: string;
}

export interface Lick {
  readonly id: string;
  readonly title: string;
  readonly pattern: readonly LickNote[];
  readonly harmonicContext: {
    readonly chords: readonly LickChord[];
    readonly originalKey: string;
    readonly function: LickFunction;
  };
  /** Derived signatures (recomputed on every parse; input values are ignored). */
  readonly contextKey: string;
  readonly functionKey: string;
  readonly chordQuality: ChordQuality | null;
  readonly patternHash: string;
  readonly visibility: Visibility;
  readonly license: string;
  readonly moderationState: ModerationState;
  readonly source: LickSource;
  readonly tags: readonly string[];
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly notes: string;
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly schemaVersion: number;
}

export class LickValidationError extends Error {
  readonly code = "invalid_lick";
}

function fail(msg: string): never {
  throw new LickValidationError(msg);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function reqString(v: unknown, field: string, max: number, allowEmpty = false): string {
  if (typeof v !== "string" || (!allowEmpty && v.trim() === "") || v.length > max) {
    fail(`${field} must be a ${allowEmpty ? "possibly-empty " : ""}string ≤ ${max} chars`);
  }
  return v;
}

function reqNumber(v: unknown, field: string, min: number, max: number, integer = false): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    fail(`${field} must be a number in [${min}, ${max}]${integer ? " (integer)" : ""}`);
  }
  return v;
}

/** Validate unknown JSON into a Lick (shared by importers, sync, tests). */
export function parseLick(input: unknown): Lick {
  if (!isRecord(input)) fail("lick must be an object");
  const id = reqString(input.id, "id", 64);
  const title = reqString(input.title, "title", 120);
  const ownerId = reqString(input.ownerId, "ownerId", 128);
  // Accept v1 or v2 on input; always normalize output to the current version.
  reqNumber(input.schemaVersion, "schemaVersion", 1, LICK_SCHEMA_VERSION, true);
  if (!Array.isArray(input.pattern) || input.pattern.length === 0 || input.pattern.length > MAX_PATTERN_NOTES) {
    fail(`pattern must have 1..${MAX_PATTERN_NOTES} notes`);
  }
  const pattern: LickNote[] = (input.pattern as unknown[]).map((n, i) => {
    if (!isRecord(n)) fail(`pattern[${i}] must be an object`);
    const stepsRaw = reqNumber(n.steps, `pattern[${i}].steps`, -14, 21, true);
    const semisRaw = reqNumber(n.semitones, `pattern[${i}].semitones`, -24, 36, true);
    // Canonical form: semitones in 0..11, octaves carried by steps.
    const carry = Math.floor(semisRaw / 12);
    const steps = stepsRaw + carry * 7;
    const semitones = semisRaw - carry * 12;
    if (steps < -14 || steps > 28) fail(`pattern[${i}] out of range after normalization`);
    return {
      steps,
      semitones,
      octaveOffset: reqNumber(n.octaveOffset, `pattern[${i}].octaveOffset`, -2, 2, true),
      startBeat: reqNumber(n.startBeat, `pattern[${i}].startBeat`, 0, 512),
      durationBeats: reqNumber(n.durationBeats, `pattern[${i}].durationBeats`, 0.0625, 64),
    };
  });
  // Monophonic: notes sorted by startBeat, no overlaps or shared onsets.
  const sorted = [...pattern].sort((a, b) => a.startBeat - b.startBeat);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1] as LickNote;
    const cur = sorted[i] as LickNote;
    if (cur.startBeat < prev.startBeat + prev.durationBeats - 1e-9) {
      fail(`pattern notes overlap at index ${i}`);
    }
  }
  if (!isRecord(input.harmonicContext)) fail("harmonicContext must be an object");
  const hc = input.harmonicContext;
  if (!Array.isArray(hc.chords) || hc.chords.length === 0 || hc.chords.length > 16) {
    fail("harmonicContext.chords must have 1..16 chords");
  }
  const chords: LickChord[] = (hc.chords as unknown[]).map((c, i) => {
    if (!isRecord(c)) fail(`chords[${i}] must be an object`);
    const symbol = reqString(c.symbol, `chords[${i}].symbol`, 24);
    try {
      parseChordSymbol(symbol);
    } catch {
      fail(`chords[${i}].symbol unparseable: ${symbol}`);
    }
    return { symbol, beats: reqNumber(c.beats, `chords[${i}].beats`, 0.25, 64) };
  });
  const totalContextBeats = chords.reduce((n, c) => n + c.beats, 0);
  if (totalContextBeats > 32) fail("harmonic context too long (max 8 bars of 4/4 = 32 beats)");
  const lastNote = pattern.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
  if (lastNote > totalContextBeats + 1e-9) fail("pattern overflows harmonic context");
  const originalKey = reqString(hc.originalKey, "harmonicContext.originalKey", 8);
  try {
    parseChordSymbol(`${originalKey}`);
  } catch {
    fail(`harmonicContext.originalKey invalid: ${originalKey}`);
  }
  if (typeof hc.function !== "string" || !(LICK_FUNCTIONS as readonly string[]).includes(hc.function)) {
    fail(`harmonicContext.function must be one of ${LICK_FUNCTIONS.join(", ")}`);
  }
  const src = isRecord(input.source) ? input.source : fail("source must be an object");
  const source: LickSource = {
    artist: reqString(src.artist, "source.artist", 120, true),
    instrument: reqString(src.instrument, "source.instrument", 40, true),
    track: reqString(src.track, "source.track", 160, true),
    album: reqString(src.album, "source.album", 160, true),
    year: src.year == null ? null : reqNumber(src.year, "source.year", 1900, 2100, true),
    recordingUrl: reqString(src.recordingUrl, "source.recordingUrl", 500, true),
    timestampSeconds: src.timestampSeconds == null ? null : reqNumber(src.timestampSeconds, "source.timestampSeconds", 0, 10_000_00),
    location: reqString(src.location, "source.location", 120, true),
  };
  const tagsRaw = input.tags ?? [];
  if (!Array.isArray(tagsRaw) || tagsRaw.length > 24 || tagsRaw.some((t) => typeof t !== "string" || t.length > 32)) {
    fail("tags must be ≤ 24 strings ≤ 32 chars");
  }
  const difficulty = reqNumber(input.difficulty, "difficulty", 1, 5, true) as 1 | 2 | 3 | 4 | 5;
  const notes = reqString(input.notes ?? "", "notes", 4000, true);
  const createdAt = reqString(input.createdAt, "createdAt", 64);
  const updatedAt = reqString(input.updatedAt, "updatedAt", 64);
  if (Number.isNaN(Date.parse(createdAt)) || Number.isNaN(Date.parse(updatedAt))) fail("createdAt/updatedAt must be ISO dates");
  const deletedAt = input.deletedAt == null ? null : reqString(input.deletedAt, "deletedAt", 64);
  const visibility = input.visibility == null ? "private" : (isEnum(input.visibility, VISIBILITIES, "visibility") as Visibility);
  const license = reqString(input.license ?? DEFAULT_LICENSE, "license", 64);
  const moderationState =
    input.moderationState == null ? "approved" : (isEnum(input.moderationState, MODERATION_STATES, "moderationState") as ModerationState);
  // Signatures are always derived (never trusted from input) — canonical form.
  const sig = signaturesOf(chords);
  const patternKey = `${sig.contextKey}`;
  const patternHash = patternHashOf(pattern, patternKey);
  return {
    id,
    title,
    pattern,
    harmonicContext: { chords, originalKey, function: hc.function as LickFunction },
    contextKey: sig.contextKey,
    functionKey: sig.functionKey,
    chordQuality: sig.chordQuality,
    patternHash,
    visibility,
    license,
    moderationState,
    source,
    tags: tagsRaw as string[],
    difficulty,
    notes,
    ownerId,
    createdAt,
    updatedAt,
    deletedAt,
    schemaVersion: LICK_SCHEMA_VERSION,
  };
}

function isEnum(v: unknown, allowed: readonly string[], field: string): string {
  if (typeof v !== "string" || !allowed.includes(v)) fail(`${field} must be one of ${allowed.join(", ")}`);
  return v;
}

/** Total beats of the harmonic context (pattern is expected to fit inside). */
export function contextBeats(lick: Lick): number {
  return lick.harmonicContext.chords.reduce((n, c) => n + c.beats, 0);
}
