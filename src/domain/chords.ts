// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/chords: chord-symbol parsing + chord tones as degrees.
// Pure. Covers the common jazz vocabulary; unknown suffixes are rejected
// (importers surface the error) rather than guessed.

import { parsePitchName, type SpelledPitch } from "./pitch.js";

export type ChordQuality =
  | "maj7"
  | "maj6"
  | "min7"
  | "min6"
  | "minmaj7"
  | "dom7"
  | "dim7"
  | "hdim7"
  | "aug"
  | "sus7"
  | "power5";

export interface ParsedChord {
  readonly root: SpelledPitch; // octave 4 placeholder; pitch class is what matters
  readonly quality: ChordQuality;
  readonly symbol: string; // normalized display form
}

export interface ChordTone {
  /** Diatonic steps above root (0,2,4,6...). */
  readonly steps: number;
  /** Semitones above root. */
  readonly semitones: number;
}

/** Core chord tones (root, third, fifth, seventh) per quality. */
export const CHORD_TONES: Record<ChordQuality, readonly ChordTone[]> = {
  maj7: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 4 },
    { steps: 4, semitones: 7 },
    { steps: 6, semitones: 11 },
  ],
  maj6: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 4 },
    { steps: 4, semitones: 7 },
    { steps: 5, semitones: 9 },
  ],
  min7: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 3 },
    { steps: 4, semitones: 7 },
    { steps: 6, semitones: 10 },
  ],
  min6: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 3 },
    { steps: 4, semitones: 7 },
    { steps: 5, semitones: 9 },
  ],
  minmaj7: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 3 },
    { steps: 4, semitones: 7 },
    { steps: 6, semitones: 11 },
  ],
  dom7: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 4 },
    { steps: 4, semitones: 7 },
    { steps: 6, semitones: 10 },
  ],
  dim7: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 3 },
    { steps: 4, semitones: 6 },
    { steps: 6, semitones: 9 },
  ],
  hdim7: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 3 },
    { steps: 4, semitones: 6 },
    { steps: 6, semitones: 10 },
  ],
  aug: [
    { steps: 0, semitones: 0 },
    { steps: 2, semitones: 4 },
    { steps: 4, semitones: 8 },
  ],
  sus7: [
    { steps: 0, semitones: 0 },
    { steps: 3, semitones: 5 },
    { steps: 4, semitones: 7 },
    { steps: 6, semitones: 10 },
  ],
  power5: [
    { steps: 0, semitones: 0 },
    { steps: 4, semitones: 7 },
  ],
};

// Longest-first so "m7b5" wins over "m", "°7" over "°", etc.
const SUFFIXES: ReadonlyArray<readonly [string, ChordQuality, string]> = [
  ["maj7", "maj7", "maj7"],
  ["Δ7", "maj7", "maj7"],
  ["Δ", "maj7", "maj7"],
  ["maj6", "maj6", "6"],
  ["6", "maj6", "6"],
  ["m(maj7)", "minmaj7", "m(maj7)"],
  ["mMaj7", "minmaj7", "m(maj7)"],
  ["m7b5", "hdim7", "ø7"],
  ["ø7", "hdim7", "ø7"],
  ["ø", "hdim7", "ø7"],
  ["o7", "dim7", "°7"],
  ["°7", "dim7", "°7"],
  ["dim7", "dim7", "°7"],
  ["°", "dim7", "°7"],
  ["o", "dim7", "°7"],
  ["m6", "min6", "m6"],
  ["m7", "min7", "m7"],
  ["min7", "min7", "m7"],
  ["m", "min7", "m7"],
  ["min", "min7", "m7"],
  ["-", "min7", "m7"],
  ["7sus", "sus7", "7sus"],
  ["sus7", "sus7", "7sus"],
  ["sus", "sus7", "7sus"],
  ["7", "dom7", "7"],
  ["9", "dom7", "7"],
  ["11", "dom7", "7"],
  ["13", "dom7", "7"],
  ["aug", "aug", "aug"],
  ["+", "aug", "aug"],
  ["5", "power5", "5"],
  ["maj", "maj7", "maj7"],
  ["", "maj7", "maj7"],
];

/** Parse "Dm7", "Eb°7", "F#m7b5", "Bb7", "C". Root keeps its spelling.
 *  Tension suffixes beyond the core (e.g. "Cmaj9#11") fall back to the core
 *  quality — matching (M3) works on core function, extensions are preserved
 *  in the symbol string. */
export function parseChordSymbol(input: string): ParsedChord {
  const trimmed = input.trim();
  const m = /^([A-Ga-g](?:bb|b|#|x)?)(.*)$/.exec(trimmed);
  if (!m?.[1]) throw new Error(`invalid chord symbol: ${input}`);
  const root = parsePitchName(m[1], 4);
  const suffix = (m[2] ?? "").trim();
  for (const [key, quality, display] of SUFFIXES) {
    if (suffix === key || (key !== "" && suffix.startsWith(key) && /^[\d#b()+_-]*$/.test(suffix.slice(key.length)))) {
      void display;
      return { root, quality, symbol: `${m[1]}${suffix}` };
    }
  }
  throw new Error(`unknown chord quality: ${input}`);
}

export function chordTones(chord: ParsedChord): readonly ChordTone[] {
  return CHORD_TONES[chord.quality];
}

/** Guide tones: third (+fourth for sus; null for power chords) and seventh (M3 overlay uses these). */
export function guideToneDegrees(chord: ParsedChord): { third: ChordTone | null; seventh: ChordTone | null } {
  const tones = CHORD_TONES[chord.quality];
  const third = tones.find((t) => t.steps === 2 || t.steps === 3) ?? null;
  const seventh = tones.find((t) => t.steps === 6 || t.steps === 5) ?? null;
  return { third, seventh };
}
