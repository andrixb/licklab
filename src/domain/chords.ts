// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/chords: chord-symbol reading backed by @jmove/generator's own
// quality engine (ADR-023). LickLab keeps NO quality tables of its own:
// no suffix list, no quality->interval map, no voicing rules. This module
// only (a) splits a symbol into root / quality / slash bass lexically,
// (b) applies a small DOCUMENTED alias table for notations JMove's own
// normalize() demonstrably misreads (each entry cites the upstream cause),
// and (c) asks JMove (parseQuality) what the quality means. The stable
// ChordQuality enum is LickLab's storage format (D1 columns, signature
// keys); its values are DERIVED from JMove's family+intervals, never
// from a local table, and are unchanged for every previously-valid symbol.

import { parseQuality } from "@jmove/generator";
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
  readonly root: SpelledPitch; // keeps its spelling (sharps stay sharp)
  readonly quality: ChordQuality; // storage-stable category derived from JMove
  readonly symbol: string; // original trimmed input (display preserved)
  /**
   * Canonical quality string handed to JMove's generator. Extensions and
   * alterations are preserved verbatim (Bb13 stays "13", never "7").
   * Slash bass is NOT included: JMove's ChordEvent has no bass field and its
   * normalize() strips it (see slashBass).
   */
  readonly jmoveQuality: string;
  /**
   * Slash-chord bass when the symbol carries one (e.g. the D in "Bb7/D").
   * Parsed for display and future use. NOT sounded today: JMove strips
   * slash bass in normalize() and ChordEvent carries no bass note, so the
   * bass follows the chord root — the same behavior as JMove's own demo,
   * which builds the same ChordEvent shape. Upstream gap, see ADR-023.
   */
  readonly slashBass: SpelledPitch | null;
}

export interface ChordTone {
  /** Diatonic steps above root (0,2,4,6...). */
  readonly steps: number;
  /** Semitones above root. */
  readonly semitones: number;
}

/**
 * JMove-canonical quality string per storage category. These are the exact
 * strings JMove's own KNOWN map resolves (chordQuality.ts): "7" (not "dom7"),
 * "m7b5" (not "hdim7"), "m(maj7)" (NOT "mMaj7", which JMove misreads with a
 * flat 7th), "5" (NOT "power5", which JMove misreads as a major triad).
 */
const CANONICAL_JMOVE: Record<ChordQuality, string> = {
  maj7: "maj7",
  maj6: "6",
  min7: "m7",
  min6: "m6",
  minmaj7: "m(maj7)",
  dom7: "7",
  dim7: "dim7",
  hdim7: "m7b5",
  aug: "aug",
  sus7: "7sus",
  power5: "5",
};

/**
 * Derive LickLab's storage-stable category from JMove's own answer
 * (family + core intervals). Covers every previously-valid symbol
 * identically (see chords.test.ts "storage stability"), and classifies
 * every other JMove-readable notation (9, 11, 13, m9, m11, m13, 69,
 * add9, sus2/sus4/9sus, dim triad, aug7, h, -, ^, o, ...) the same way
 * JMove's family classification does.
 *
 * Documented approximations (no exact enum member exists):
 * - major triad / add9 / maj7#5 -> maj7 (keeps the major function for
 *   matching; the color still sounds via jmoveQuality).
 * - diminished triad -> dim7. Bare sus2/sus4 -> sus7. aug7 -> dom7
 *   (JMove's own family for aug7 is dominant).
 */
function toChordQuality(family: string, intervals: readonly number[]): ChordQuality {
  const has = (n: number): boolean => intervals.includes(n);
  switch (family) {
    case "major":
      return has(11) ? "maj7" : has(9) ? "maj6" : "maj7";
    case "minor":
      return has(11) ? "minmaj7" : has(9) ? "min6" : "min7";
    case "dominant":
      return "dom7";
    case "halfDiminished":
      return "hdim7";
    case "diminished":
      return "dim7";
    case "augmented":
      return "aug";
    case "suspended":
      return "sus7";
    case "power":
      return "power5";
    default:
      throw new Error(`unknown JMove quality family: ${family}`);
  }
}

/**
 * Diatonic steps for a JMove core interval by its POSITION in JMove's
 * "R-3-5-7/6, no upper extensions" interval array (chordQuality.ts
 * ParsedQuality contract). Generic letter arithmetic, quality-independent:
 * position 0 is the root, 1 the third (or sus 2nd/4th), 2 the fifth
 * (natural, diminished or augmented — always fifth-letter), 3 the
 * seventh — except a 9-semitone 4th element over a major/minor family,
 * which is the sixth (maj6/min6), and a 9-semitone 4th element over a
 * diminished family, which is the diminished 7th (seventh-letter, Bbb).
 */
function stepsFor(family: string, index: number, value: number): number {
  if (index === 0) return 0;
  if (index === 1) {
    if (value === 3 || value === 4) return 2; // third (minor/major)
    if (value === 5) return 3; // sus4: fourth
    if (value === 2) return 1; // sus2: second
    if (value === 7 && family === "power") return 4; // power chord: fifth
    throw new Error(`unspellable JMove third interval: ${value}`);
  }
  if (index === 2) {
    if (value === 6 || value === 7 || value === 8) return 4; // fifth (dim/nat/aug)
    throw new Error(`unspellable JMove fifth interval: ${value}`);
  }
  if (index === 3) {
    if (value === 9 && (family === "major" || family === "minor")) return 5; // sixth
    if (value === 9 || value === 10 || value === 11) return 6; // bb7/b7/7
    throw new Error(`unspellable JMove seventh interval: ${value}`);
  }
  throw new Error(`unexpected JMove interval position: ${index}`);
}

/** Core chord tones (root, third, fifth, seventh/sixth) DERIVED from JMove. */
function tonesFor(quality: ChordQuality): readonly ChordTone[] {
  const parsed = parseQuality(CANONICAL_JMOVE[quality]);
  return parsed.intervals.map((semitones, index) => ({
    steps: stepsFor(parsed.family, index, semitones),
    semitones,
  }));
}

/**
 * Core chord tones per storage category, derived at load from JMove's own
 * interval sets (byte-identical to the hand-written table this replaced;
 * see chords.test.ts). The local fallback band engine and the matching
 * plausibility checks read these; the JMove-backed generator path voices
 * from JMove directly and never consults this table.
 */
export const CHORD_TONES: Record<ChordQuality, readonly ChordTone[]> = {
  maj7: tonesFor("maj7"),
  maj6: tonesFor("maj6"),
  min7: tonesFor("min7"),
  min6: tonesFor("min6"),
  minmaj7: tonesFor("minmaj7"),
  dom7: tonesFor("dom7"),
  dim7: tonesFor("dim7"),
  hdim7: tonesFor("hdim7"),
  aug: tonesFor("aug"),
  sus7: tonesFor("sus7"),
  power5: tonesFor("power5"),
};

/**
 * Compatibility aliases: notations JMove 1.5.1's own normalize() provably
 * misreads (verified by probe against the pinned package; see ADR-023),
 * mapped to the JMove-canonical form with IDENTICAL musical meaning.
 * Everything else passes through to JMove verbatim — including all
 * extensions and alterations (7#9, 7b9, 13, 7alt, ...) which JMove's
 * KNOWN map and algorithmic parser already understand.
 *
 * - "°"/"°7" -> "o"/"o7": JMove only knows the iReal ASCII "o"; "°7"
 *   misreads as dominant. (LickLab's historic diminished sign.)
 * - "Δ"/"Δ7" -> "maj7": JMove normalizes "^" but not "Δ"; "Δ7" misreads
 *   as dominant. (LickLab accepted Δ before; keep accepting it.)
 * - /^M(?=\d)/ -> "maj": JMove reads "M7" as dominant (case-sensitive
 *   "maj" check). Standard "M = major" notation.
 * - "MMaj7" -> "maj7": same case-sensitivity gap.
 * - "mMaj7"/"mMaj9" -> "m(maj7)": JMove's /maj\d/ test is lowercase-only,
 *   so "mMaj7" misreads with a FLAT 7th. ("mMaj9" additionally drops the
 *   9th color in matching only; reported upstream, see ADR-023.)
 * - "power5" -> "5": JMove reads "power5" as a major TRIAD (with a third).
 * - "7+" -> "7#5": JMove has no "+"-suffix rule ("+7" is aug7, bare "+"
 *   is aug — both native, untouched).
 * - "alt" -> "7alt": bare "alt" falls through to major; the altered
 *   dominant is "7alt".
 * - "♭"/"♯" -> "b"/"#": lexical unicode accidentals (JMove roots and
 *   qualities are ASCII; its root reader handles single b/# only).
 */
function toJmoveQuality(raw: string): string {
  let q = raw.replace(/♭/g, "b").replace(/♯/g, "#");
  q = q.replace(/°/g, "o");
  if (q === "Δ" || q === "Δ7") return "maj7";
  if (q === "MMaj7") return "maj7";
  if (q === "mMaj7" || q === "mMaj9") return "m(maj7)";
  if (q === "power5") return "5";
  if (q === "7+") return "7#5";
  if (q === "alt") return "7alt";
  if (/^M(?=\d)/.test(q)) return `maj${q.slice(1)}`;
  if (/[Δ°]/.test(q)) {
    throw new Error(`unsupported chord notation (use o for °, maj7 for Δ): ${raw}`);
  }
  return q;
}

/**
 * Parse "Dm7", "Bb7#9", "G7alt", "F#m7b5", "Bb7/D", "CΔ7". The root boundary
 * is lexical ([A-G] + accidentals); the root keeps its spelling, including
 * double accidentals. The slash rule mirrors JMove's own normalize():
 * "/X" is a bass note when X is a single note name (stripped for the
 * generator, which has no bass field), otherwise part of the quality
 * ("6/9" stays whole). Quality MEANING always comes from JMove.
 */
export function parseChordSymbol(input: string): ParsedChord {
  const trimmed = input.trim().replace(/♭/g, "b").replace(/♯/g, "#");
  // Greedy accidental capture (as before) so "Bbb7" reads as root "Bbb".
  const m = /^([A-Ga-g])((?:bb|b|#|x)?)(.*)$/.exec(trimmed);
  if (!m?.[1]) throw new Error(`invalid chord symbol: ${input}`);
  const accidental = m[2] ?? "";
  const rootText = `${m[1]}${accidental}`;
  // NOTE: double accidentals (bb/x) are accepted and keep their spelling
  // for display, matching and the local fallback engine. JMove's own root
  // reader handles single b/# only, so the JMove adapter respells them to
  // single-accidental enharmonics when building ChordEvents (see
  // adapters/jmove/generator.ts jmoveRootName). JMove misreads them as
  // another pitch if passed through, hence the split responsibility.
  const root = parsePitchName(rootText, 4);
  const rest = (m[3] ?? "").trim();
  // Slash rule transcribed from JMove chordQuality.ts normalize(): a slash
  // followed by a single note name is a bass note, otherwise (e.g. "6/9")
  // the slash belongs to the quality.
  let qualityRaw = rest;
  let slashBass: SpelledPitch | null = null;
  const slashIdx = rest.indexOf("/");
  if (slashIdx >= 0) {
    const after = rest.slice(slashIdx + 1);
    if (/^[A-Ga-g][#b]?$/.test(after)) {
      qualityRaw = rest.slice(0, slashIdx);
      slashBass = parsePitchName(after, 4);
    }
  }
  const jmoveQuality = toJmoveQuality(qualityRaw);
  const parsed = parseQuality(jmoveQuality);
  const quality = toChordQuality(parsed.family, parsed.intervals);
  return { root, quality, symbol: trimmed, jmoveQuality, slashBass };
}

export function chordTones(chord: ParsedChord): readonly ChordTone[] {
  return CHORD_TONES[chord.quality];
}

/** Core tones by storage category (for callers with no parsed symbol). */
export function chordTonesFor(quality: ChordQuality): readonly ChordTone[] {
  return CHORD_TONES[quality];
}

/**
 * Guide tones: third (fourth for sus; null for power chords) and seventh
 * (sixth for 6 chords, as before). Positions in JMove's R-3-5-7/6 array,
 * values from JMove — the matching overlay (M3) consumes these.
 */
export function guideToneDegrees(chord: ParsedChord): { third: ChordTone | null; seventh: ChordTone | null } {
  const tones = CHORD_TONES[chord.quality];
  const third = tones[1] ?? null;
  const seventh = tones[3] ?? null;
  if (chord.quality === "power5") return { third: null, seventh };
  return { third, seventh };
}
