// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/transpose: re-root a lick's degree pattern onto a target root,
// spelling every note from scale degrees (correct enharmonics guaranteed
// by pitch.spellDegree).

import { parseChordSymbol } from "./chords.js";
import type { Lick } from "./lick.js";
import { LETTERS, letterIndex, midiOf, pitchName, spellDegree, type SpelledPitch } from "./pitch.js";

export interface SoundingNote {
  readonly pitch: SpelledPitch;
  readonly startBeat: number;
  readonly durationBeats: number;
}

/**
 * Sound the lick's pattern over `targetRoot` (a chord root in the song bar).
 * Degrees are interpreted relative to the lick's first context chord root.
 */
export function transposeLick(lick: Lick, targetRoot: SpelledPitch): SoundingNote[] {
  const first = lick.harmonicContext.chords[0];
  if (!first) throw new Error("lick has no context chords");
  const sourceRoot = parseChordSymbol(first.symbol).root;
  void sourceRoot;
  return lick.pattern.map((n) => ({
    pitch: spellDegree(targetRoot, {
      steps: n.steps,
      semitones: n.semitones,
    }),
    startBeat: n.startBeat,
    durationBeats: n.durationBeats,
  }));
}

/** Octave-shift sounding notes (e.g. bass-clef display keeps concert pitch; this is for instrument ranges). */
export function shiftOctave(notes: readonly SoundingNote[], octaves: number): SoundingNote[] {
  if (!Number.isInteger(octaves)) throw new Error("octaves must be integer");
  return notes.map((n) => ({
    ...n,
    pitch: { ...n.pitch, octave: n.pitch.octave + octaves },
  }));
}

/**
 * Shift a chord root by semitones, keeping the closest sensible spelling
 * (same letter preferred, then neighbor letters). Used for Bb (+2) / Eb (+9)
 * instrument views: the lick is re-rooted, so degrees re-spell correctly.
 */
export function transposeRoot(root: SpelledPitch, semitones: number): SpelledPitch {
  if (!Number.isInteger(semitones)) throw new Error("semitones must be integer");
  const targetMidi = midiOf(root) + semitones;
  const baseIdx = letterIndex(root.letter);
  const naturals = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;
  const candidates: SpelledPitch[] = [];
  for (const letter of LETTERS) {
    for (let octave = root.octave - 2; octave <= root.octave + 2; octave++) {
      const acc = targetMidi - ((octave + 1) * 12 + naturals[letter]);
      if (acc >= -2 && acc <= 2) candidates.push({ letter, accidental: acc as SpelledPitch["accidental"], octave });
    }
  }
  /* v8 ignore next -- unreachable: every pc spells within ±2 accidentals across ±2 octaves */
  if (candidates.length === 0) throw new Error("unspellable transposition");
  // Fewest accidentals win; ties break toward the transposition direction
  // (Db+2 -> Eb not D#; Bb-2 -> Ab not G#).
  const dir = semitones === 0 ? 0 : semitones > 0 ? 1 : -1;
  const displacement = (p: SpelledPitch): number =>
    (p.octave - root.octave) * 7 + (letterIndex(p.letter) - baseIdx);
  candidates.sort((a, b) => {
    const aa = Math.abs(a.accidental);
    const bb = Math.abs(b.accidental);
    if (aa !== bb) return aa - bb;
    const sa = Math.sign(displacement(a));
    const sb = Math.sign(displacement(b));
    if (sa === dir && sb !== dir) return -1;
    if (sb === dir && sa !== dir) return 1;
    return Math.abs(displacement(a)) - Math.abs(displacement(b));
  });
  return candidates[0] as SpelledPitch;
}

/** Drop whole octaves until the mean pitch fits a readable staff (bass clef). */
export function fitBassRange(notes: readonly SoundingNote[], targetMean = 55): SoundingNote[] {
  if (notes.length === 0) return [];
  let out = [...notes];
  while (out.reduce((n, x) => n + midiOf(x.pitch), 0) / out.length > targetMean) {
    out = shiftOctave(out, -1);
  }
  return out;
}

/** Transpose a chord symbol's root, suffix preserved: "Dm7" +2 -> "Em7". */
export function transposeChordSymbol(symbol: string, semitones: number): string {
  const parsed = parseChordSymbol(symbol);
  // Root text length always equals the canonical rendering length
  // (pitchName uses the same b/bb/#/x spellings the parser accepts).
  const suffix = parsed.symbol.slice(pitchName(parsed.root).length);
  return `${pitchName(transposeRoot(parsed.root, semitones))}${suffix}`;
}
