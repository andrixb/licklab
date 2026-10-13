// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/progression: Progression entity (private to its owner; shareable as
// a stateless URL) + the segment analyzer that finds harmonic patterns.
// Pure: parsing/validation here, matching lives in matching.ts.

import { parseChordSymbol } from "./chords.js";
import { contextKeyOf, FUNCTION_RULES, functionKeyOf, signatureOf, type SignatureChord } from "./signatures.js";
import type { LickChord } from "./lick.js";

export const PROGRESSION_SCHEMA_VERSION = 1;

export interface ProgressionBar {
  readonly chords: readonly LickChord[]; // 1..4 chords per bar
}

export interface Progression {
  readonly id: string;
  readonly title: string;
  readonly key: string;
  readonly bars: readonly ProgressionBar[];
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly schemaVersion: number;
}

export class ProgressionValidationError extends Error {
  readonly code = "invalid_progression";
}

function fail(msg: string): never {
  throw new ProgressionValidationError(msg);
}

/** Normalize typed input "Dm7 G7 | Cmaj7 |" into chords (4 beats each, split per bar). */
export function parseProgressionInput(input: string): ProgressionBar[] {
  const bars: ProgressionBar[] = [];
  for (const part of input.split("|")) {
    const symbols = part.trim().split(/\s+/).filter(Boolean);
    if (symbols.length === 0) continue;
    if (symbols.length > 4) fail("max 4 chords per bar");
    const beats = 4 / symbols.length;
    for (const symbol of symbols) {
      try {
        parseChordSymbol(symbol);
      } catch {
        fail(`unparseable chord: ${symbol}`);
      }
    }
    bars.push({ chords: symbols.map((symbol) => ({ symbol, beats })) });
  }
  if (bars.length === 0) fail("no bars found");
  if (bars.length > 64) fail("too many bars (max 64)");
  return bars;
}

export interface FlatChord {
  readonly symbol: string;
  readonly beats: number;
  readonly startBeat: number;
}

export function flattenProgression(bars: readonly ProgressionBar[]): FlatChord[] {
  const out: FlatChord[] = [];
  let beat = 0;
  for (const bar of bars) {
    for (const c of bar.chords) {
      out.push({ symbol: c.symbol, beats: c.beats, startBeat: beat });
      beat += c.beats;
    }
  }
  return out;
}

export interface Segment {
  readonly chords: readonly LickChord[];
  readonly signature: readonly SignatureChord[];
  readonly contextKey: string;
  readonly functionKey: string;
  /** Absolute beat in the progression where this segment starts. */
  readonly startBeat: number;
  readonly endBeat: number;
}

interface RuleMatch {
  readonly start: number;
  readonly length: number;
  readonly priority: number; // index in FUNCTION_RULES (lower = more specific)
}

/**
 * 12-bar blues by anchor bars (relative root intervals; -1 = any). Accepts
 * quick-change and plain bar 2-4, since those vary between charts. Anchors:
 * bar1 I, bars5-6 IV, bars7-8 I, bar9 V, bar10 IV, bar11 I, bar12 V|I.
 */
const BLUES_ANCHORS: readonly (number | "V_I")[] = [0, -1, -1, -1, 5, 5, 0, 0, 7, 5, 0, "V_I"];

/** 12-bar blues: all dominant 7th, canonical anchor bars, last bar V or I. */
export function isBlues12(sig: readonly SignatureChord[]): boolean {
  if (sig.length !== 12) return false;
  if (!sig.every((c) => c.quality === "dom7")) return false;
  const iv = sig.map((c) => c.rootInterval);
  return BLUES_ANCHORS.every((want, i) => {
    if (want === -1) return true;
    if (want === "V_I") return iv[i] === 7 || iv[i] === 0;
    return iv[i] === want;
  });
}

function findRuleWindows(sig: readonly SignatureChord[]): RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (let start = 0; start < sig.length; start++) {
    for (const [priority, rule] of FUNCTION_RULES.entries()) {
      const end = start + rule.length;
      if (end > sig.length) continue;
      if (rule.test(sig.slice(start, end))) matches.push({ start, length: rule.length, priority });
    }
  }
  return matches;
}

/**
 * Analyze a chord sequence into segments: multi-chord patterns first
 * (longest, then earliest, then rule specificity), uncovered chords become
 * single-chord segments. Blues-shaped 12-chord inputs collapse to one
 * "blues.12bar" segment.
 */
export function analyzeChords(chords: readonly LickChord[], flat: readonly FlatChord[]): Segment[] {
  if (chords.length === 0) return [];
  const seg = (start: number, length: number, functionKey?: string): Segment => {
    const slice = chords.slice(start, start + length);
    const signature = signatureOf(slice);
    const startBeat = flat[start]?.startBeat ?? 0;
    const last = flat[start + length - 1];
    return {
      chords: slice,
      signature,
      contextKey: contextKeyOf(slice),
      functionKey: functionKey ?? functionKeyOf(slice),
      startBeat,
      endBeat: (last?.startBeat ?? startBeat) + (last?.beats ?? 0),
    };
  };

  const sig = signatureOf(chords);
  if (isBlues12(sig)) {
    const beatOf = (i: number): number => flat[i]?.startBeat ?? 0;
    const beatsOf = (i: number): number => flat[i]?.beats ?? 0;
    return [
      {
        chords,
        signature: sig,
        contextKey: contextKeyOf(chords),
        functionKey: "blues.12bar",
        startBeat: beatOf(0),
        endBeat: beatOf(chords.length - 1) + beatsOf(chords.length - 1),
      },
    ];
  }

  // Greedy: longest first, then earliest start, then most specific rule.
  const windows = findRuleWindows(sig).sort((a, b) => b.length - a.length || a.start - b.start || a.priority - b.priority);
  const covered = new Array<boolean>(chords.length).fill(false);
  const chosen: { start: number; length: number }[] = [];
  for (const w of windows) {
    if (covered.slice(w.start, w.start + w.length).some(Boolean)) continue;
    chosen.push({ start: w.start, length: w.length });
    for (let i = w.start; i < w.start + w.length; i++) covered[i] = true;
  }
  chosen.sort((a, b) => a.start - b.start);

  const out: Segment[] = chosen.map((c) => seg(c.start, c.length));
  for (let i = 0; i < chords.length; i++) {
    if (covered[i]) continue;
    out.push(seg(i, 1));
    covered[i] = true;
  }
  return out;
}

export function analyzeProgression(p: Progression): Segment[] {
  const bars = p.bars.length > 0 ? p.bars : fail("progression has no bars");
  const flat = flattenProgression(bars);
  return analyzeChords(flat.map((c) => ({ symbol: c.symbol, beats: c.beats })), flat);
}

// ---- Presets (self-written; ship with the app, no API needed) ----

export interface Preset {
  readonly id: string;
  readonly title: string;
  readonly bars: readonly ProgressionBar[];
}

const bar = (input: string): ProgressionBar => {
  const first = parseProgressionInput(input)[0];
  if (!first) throw new Error("preset bar parsed to empty");
  return { chords: first.chords };
};

export const PRESETS: readonly Preset[] = [
  {
    id: "iiv-i-major",
    title: "ii-V-I (major)",
    bars: [bar("Dm7"), bar("G7"), bar("Cmaj7"), bar("Cmaj7")],
  },
  {
    id: "iiv-i-minor",
    title: "ii-V-i (minor)",
    bars: [bar("Dm7b5"), bar("G7"), bar("Cm7"), bar("Cm7")],
  },
  {
    id: "blues-f",
    title: "Blues in F (12 bar)",
    bars: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "F7", "C7", "Bb7", "F7", "C7"].map((s) => bar(s)),
  },
  {
    id: "rhythm-a",
    title: "Rhythm changes (A section)",
    bars: [bar("Cmaj7 Am7"), bar("Dm7 G7"), bar("Em7 A7"), bar("Dm7 G7")],
  },
  {
    id: "turnaround",
    title: "Turnaround (I-vi-ii-V)",
    bars: [bar("Cmaj7"), bar("Am7"), bar("Dm7"), bar("G7")],
  },
  {
    id: "static-major",
    title: "One chord: maj7",
    bars: [bar("Cmaj7"), bar("Cmaj7")],
  },
  {
    id: "static-minor",
    title: "One chord: m7",
    bars: [bar("Am7"), bar("Am7")],
  },
];
