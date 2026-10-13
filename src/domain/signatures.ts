// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/signatures: key-independent signatures for harmonic contexts and
// licks. Everything here is pure and transposition-invariant: the same
// shapes in any key produce the same contextKey/functionKey, and matching
// never looks at absolute pitch classes (property-tested).

import { chordTones, parseChordSymbol, type ChordQuality } from "./chords.js";
import { pitchClassOf } from "./pitch.js";

// Structural inputs (no import from lick.ts — lick.ts depends on signatures,
// never the reverse; keeps the domain acyclic).
export interface ChordInput {
  readonly symbol: string;
  readonly beats: number;
}
export interface NoteInput {
  readonly steps: number;
  readonly semitones: number;
  readonly octaveOffset: number;
  readonly startBeat: number;
  readonly durationBeats: number;
}

/** Short codes used inside signature keys (stable — stored in D1 + caches). */
export const QUALITY_CODE: Record<ChordQuality, string> = {
  maj7: "M",
  maj6: "6",
  min7: "m",
  min6: "m6",
  minmaj7: "mM",
  dom7: "7",
  dim7: "d",
  hdim7: "h",
  aug: "A",
  sus7: "s",
  power5: "5",
};

export type ChordFamily = "maj" | "min" | "dom" | "halfdim" | "dim";

export function familyOf(q: ChordQuality): ChordFamily {
  switch (q) {
    case "maj7":
    case "maj6":
      return "maj";
    case "min7":
    case "min6":
    case "minmaj7":
      return "min";
    case "dom7":
    case "sus7":
    case "aug":
      return "dom";
    case "hdim7":
      return "halfdim";
    case "dim7":
      return "dim";
    case "power5":
      return "dom";
  }
}

/** Beats bucketed to a quarter-beat grid (4, 4.0, 4.25 → 4) for stable keys. */
export function bucketBeats(beats: number): number {
  return Math.round(beats * 4) / 4;
}

export interface SignatureChord {
  readonly quality: ChordQuality;
  /** Semitones above the first chord's root, 0..11. */
  readonly rootInterval: number;
  readonly beats: number;
}

/** Normalize chords to (quality, root interval from first chord, bucketed beats). */
export function signatureOf(chords: readonly ChordInput[]): SignatureChord[] {
  if (chords.length === 0) throw new Error("signature needs at least one chord");
  const parsed = chords.map((c) => {
    const p = parseChordSymbol(c.symbol);
    return { quality: p.quality, pc: pitchClassOf(p.root), beats: c.beats };
  });
  const first = parsed[0] as (typeof parsed)[number];
  return parsed.map((c) => ({
    quality: c.quality,
    rootInterval: (((c.pc - first.pc) % 12) + 12) % 12,
    beats: bucketBeats(c.beats),
  }));
}

/**
 * contextKey: qualities + root intervals from the first chord + durations.
 * "Dm7 G7 Cmaj7" (and its 12-key transpositions) →
 * "m@0:4.7@5:4.M@10:4" (intervals measured from the first root).
 */
export function contextKeyOf(chords: readonly ChordInput[]): string {
  return signatureOf(chords)
    .map((c) => `${QUALITY_CODE[c.quality]}@${c.rootInterval}:${c.beats}`)
    .join(".");
}

/** Root motion in circle-of-fifths steps: V→I = +1, ii→V = +1 (descending fifths count +1). */
export function fifthStep(fromPc: number, toPc: number): number {
  const d = (((fromPc - toPc) % 12) + 12) % 12;
  const raw = (d * 7) % 12;
  return raw > 6 ? raw - 12 : raw;
}

const CODES = (sig: readonly SignatureChord[], i: number): ChordQuality => sig[i]?.quality ?? "maj7";
const FAMS = (sig: readonly SignatureChord[], i: number): ChordFamily => familyOf(CODES(sig, i));

// Out-of-range root interval is -1 — never matches a rule (legal values are 0..11).
const ri = (sig: readonly SignatureChord[], i: number): number => sig[i]?.rootInterval ?? -1;

export interface FunctionRule {
  readonly key: string;
  readonly length: number;
  /** Match on the normalized signature of the segment. */
  readonly test: (sig: readonly SignatureChord[]) => boolean;
}

const intervalsOf = (sig: readonly SignatureChord[]): number[] => sig.map((c) => c.rootInterval);

/**
 * Rules match segments of EXACTLY `length` chords (an author's declared
 * context is matched whole). Ordered most-specific first; first match wins.
 */
export const FUNCTION_RULES: readonly FunctionRule[] = [
  {
    key: "ii-V-I.maj",
    length: 3,
    test: (s) =>
      (FAMS(s, 0) === "min" || FAMS(s, 0) === "halfdim") &&
      FAMS(s, 1) === "dom" &&
      FAMS(s, 2) === "maj" &&
      fifthStep(ri(s, 0), ri(s, 1)) === 1 &&
      fifthStep(ri(s, 1), ri(s, 2)) === 1,
  },
  {
    key: "ii-V-i.min",
    length: 3,
    test: (s) =>
      (FAMS(s, 0) === "halfdim" || FAMS(s, 0) === "min") &&
      FAMS(s, 1) === "dom" &&
      FAMS(s, 2) === "min" &&
      fifthStep(ri(s, 0), ri(s, 1)) === 1 &&
      fifthStep(ri(s, 1), ri(s, 2)) === 1,
  },
  {
    key: "cycle.of-fifths",
    length: 3,
    test: (s) =>
      [0, 1, 2].every((i) => FAMS(s, i) === "dom" || FAMS(s, i) === "min") &&
      fifthStep(ri(s, 0), ri(s, 1)) === 1 &&
      fifthStep(ri(s, 1), ri(s, 2)) === 1,
  },
  {
    key: "turnaround.maj",
    length: 4,
    test: (s) => {
      const iv = intervalsOf(s);
      return (
        FAMS(s, 0) === "maj" &&
        FAMS(s, 1) === "min" &&
        FAMS(s, 2) === "min" &&
        FAMS(s, 3) === "dom" &&
        iv[0] === 0 &&
        iv[1] === 9 &&
        iv[2] === 2 &&
        iv[3] === 7
      );
    },
  },
  {
    // Tritone sub resolution: subV7 falls a half step onto I (Db7 → Cmaj7).
    key: "V-I.tritone",
    length: 2,
    test: (s) =>
      FAMS(s, 0) === "dom" &&
      (FAMS(s, 1) === "maj" || FAMS(s, 1) === "min") &&
      ri(s, 1) === (ri(s, 0) + 11) % 12,
  },
  {
    key: "V-I.maj",
    length: 2,
    test: (s) => FAMS(s, 0) === "dom" && FAMS(s, 1) === "maj" && fifthStep(ri(s, 0), ri(s, 1)) === 1,
  },
  {
    key: "V-I.min",
    length: 2,
    test: (s) => FAMS(s, 0) === "dom" && FAMS(s, 1) === "min" && fifthStep(ri(s, 0), ri(s, 1)) === 1,
  },
  {
    key: "ii-V",
    length: 2,
    test: (s) =>
      (FAMS(s, 0) === "min" || FAMS(s, 0) === "halfdim") &&
      FAMS(s, 1) === "dom" &&
      fifthStep(ri(s, 0), ri(s, 1)) === 1,
  },
];

/** Derived harmonic function of a chord sequence; "other" when no rule fits. */
export function functionKeyOf(chords: readonly ChordInput[]): string {
  const sig = signatureOf(chords);
  for (const rule of FUNCTION_RULES) {
    if (rule.length === sig.length && rule.test(sig)) return rule.key;
  }
  if (sig.length === 1) {
    const first = sig[0];
    if (!first) return "other";
    const fam = familyOf(first.quality);
    return fam === "dom" ? "dom" : `static.${fam}`;
  }
  return "other";
}

/** Chord quality of a single-chord context (tier-3 key); null for multi-chord contexts. */
export function chordQualityOf(chords: readonly ChordInput[]): ChordQuality | null {
  if (chords.length !== 1) return null;
  const only = chords[0];
  return only ? parseChordSymbol(only.symbol).quality : null;
}

/** FNV-1a 64-bit (BigInt) — pure, sync, runtime-portable; dedup key, not a security primitive. */
export function fnv1a64(input: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.codePointAt(i) ?? 0);
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

/**
 * patternHash: normalized phrase (degrees + rhythm) + contextKey.
 * Identical phrases with different spellings of the same degree
 * (semitones outside 0..11) canonicalize first via parseLick.
 */
export function patternHashOf(pattern: readonly NoteInput[], contextKey: string): string {
  const canon = pattern
    .map((n) => `${n.steps}.${n.semitones}.${n.octaveOffset}@${Math.round(n.startBeat * 100)}+${Math.round(n.durationBeats * 100)}`)
    .join(",");
  return fnv1a64(`${canon}|${contextKey}`);
}

/** All signature fields for a lick context (stored on the entity + D1 columns). */
export interface LickSignatures {
  readonly contextKey: string;
  readonly functionKey: string;
  readonly chordQuality: ChordQuality | null;
}

export function signaturesOf(chords: readonly ChordInput[]): LickSignatures {
  return {
    contextKey: contextKeyOf(chords),
    functionKey: functionKeyOf(chords),
    chordQuality: chordQualityOf(chords),
  };
}

/** Chord-tone + common-tension semitones (mod 12) for plausibility checks. */
export function acceptableTones(quality: ChordQuality): ReadonlySet<number> {
  const tones = new Set<number>(chordTones({ root: { letter: "C", accidental: 0, octave: 4 }, quality, symbol: "" }).map((t) => t.semitones % 12));
  if (quality !== "power5" && quality !== "aug") tones.add(2); // 9th
  if (quality === "min7" || quality === "dom7") tones.add(5); // 11th
  if (quality === "maj7" || quality === "min7" || quality === "dom7") tones.add(9); // 13th
  return tones;
}
