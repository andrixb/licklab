// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/abc: ABC-notation interchange for licks (entry + notation).
// Supported subset (documented in domain.md): monophonic line, headers X:/L:/K:,
// notes A-G/a-g with ^ _ = accidentals, ' , octave marks, lengths (2, /2, 3/2),
// rests z, bar lines |. Ties, chords, tuplets, and decorations are rejected.
// Beats: L:1/8 default (eighth = 0.5 beats); durations convert to quarter-beats.

import { pitchClassOf, type SpelledPitch } from "./pitch.js";
import type { LickNote } from "./lick.js";
import type { SoundingNote } from "./transpose.js";

export class AbcError extends Error {
  readonly code = "invalid_abc";
}

export interface AbcNote {
  readonly letter: string; // A-G (upper = lower octave, lower = upper)
  readonly accidental: -2 | -1 | 0 | 1 | 2 | null; // null = inherit key (we always emit explicit)
  readonly octaveShift: number; // ' = +1, , = -1 (applied after case rule)
  readonly lengthBeats: number; // in quarter-note beats
  readonly rest: boolean;
}

const ACC_TO_ABC: Record<string, string> = {
  "-2": "__",
  "-1": "_",
  "0": "=",
  "1": "^",
  "2": "^^",
};

/** ABC pitch spelling for an explicit accidental + letter + octave. ABC: C = middle C (C4). */
export function abcNoteToken(pitch: SpelledPitch): string {
  const acc = ACC_TO_ABC[String(pitch.accidental)] ?? "";
  const diff = pitch.octave - 4;
  const token = diff === 0 ? pitch.letter : diff < 0 ? `${pitch.letter}${",".repeat(-diff)}` : `${pitch.letter.toLowerCase()}${"'".repeat(diff - 1)}`;
  return `${acc}${token}`;
}

/** Render sounding notes as an ABC tune (explicit accidentals, K:C, V: clef). */
export function soundingToAbc(
  notes: readonly SoundingNote[],
  opts: { title?: string; clef?: "treble" | "bass"; unitBeats?: number } = {},
): string {
  const { title = "Lick", clef = "treble", unitBeats = 0.5 } = opts;
  const body = notes
    .map((n) => {
      const token = abcNoteToken(n.pitch);
      const units = n.durationBeats / unitBeats;
      const len = Number.isInteger(units) ? (units === 1 ? "" : String(units)) : units.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
      return `${token}${len}`;
    })
    .join(" ");
  return `X:1\nT:${title}\nM:C\nL:1/8\nK:C clef=${clef}\n${body} |]`;
}

/** Parse supported-subset ABC into notes with quarter-beats (rests included). */
export function parseAbcNotes(input: string): AbcNote[] {
  const lines = input.split("\n");
  let unitBeats = 0.5;
  const music: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^[A-Za-z]:/.test(t)) {
      const lm = /^L:\s*1\/(\d+)\s*$/.exec(t);
      if (lm?.[1]) unitBeats = 4 / Number(lm[1]);
      continue;
    }
    if (t === "" || t.startsWith("%")) continue;
    music.push(t);
  }
  const src = music.join(" ");
  const out: AbcNote[] = [];
  const re = /(__|_|=|\^\^|\^)?([A-Ga-gzZ])([,']*)(\d+\/\d+|\d+\/|\/\d+|\d+)?|\|+:?|:?\|+|\[|\]/g;
  let m: RegExpExecArray | null;
  const lenToUnits = (s: string | undefined): number => {
    if (!s) return 1;
    if (s.includes("/")) {
      const [a, b] = s.split("/");
      const num = a === "" ? 1 : Number(a);
      const den = b === "" || b === undefined ? 2 : Number(b);
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) throw new AbcError(`bad length: ${s}`);
      return num / den;
    }
    const n = Number(s);
    if (!Number.isFinite(n)) throw new AbcError(`bad length: ${s}`);
    return n;
  };
  while ((m = re.exec(src)) !== null) {
    const [, accStr, letter, octaveMarks, lenStr] = m;
    if (letter === undefined) continue; // bar lines, brackets
    const isRest = letter === "z" || letter === "Z";
    const units = lenToUnits(lenStr);
    const accidental =
      accStr === "__" ? -2 : accStr === "_" ? -1 : accStr === "=" ? 0 : accStr === "^" ? 1 : accStr === "^^" ? 2 : null;
    let shift = 0;
    for (const c of octaveMarks ?? "") shift += c === "'" ? 1 : -1;
    out.push({
      letter: isRest ? "z" : letter.toUpperCase(),
      accidental: (isRest ? null : accidental) as AbcNote["accidental"],
      octaveShift: shift,
      lengthBeats: units * unitBeats,
      rest: isRest,
    });
  }
  if (out.length === 0) throw new AbcError("no notes found");
  return out;
}

/** Convert parsed ABC notes to a lick pattern relative to `root` (rests become gaps). */
export function abcToPattern(
  notes: readonly AbcNote[],
  root: SpelledPitch,
): { pattern: LickNote[]; totalBeats: number } {
  const rootPc = pitchClassOf(root);
  const pattern: LickNote[] = [];
  let beat = 0;
  for (const n of notes) {
    if (n.rest) {
      beat += n.lengthBeats;
      continue;
    }
    // ABC absolute pitch -> pc + diatonic letter.
    const upper = n.letter.toUpperCase();
    const isLower = n.letter !== upper;
    const letterIdx = "CDEFGAB".indexOf(upper);
    const naturalPc = [0, 2, 4, 5, 7, 9, 11][letterIdx] as number;
    const acc = n.accidental ?? 0;
    const pc = (((naturalPc + acc) % 12) + 12) % 12;
    // ABC octave: bare upper = 4 (middle-C octave), each comma -1;
    // bare lower = 5, each quote +1.
    const abcOctave = (isLower ? 5 : 4) + n.octaveShift;
    const semitones = (((pc - rootPc) % 12) + 12) % 12;
    const rootIdx = "CDEFGAB".indexOf(root.letter);
    const steps = letterIdx - rootIdx + 7 * (abcOctave - root.octave);
    pattern.push({ steps, semitones, octaveOffset: 0, startBeat: beat, durationBeats: n.lengthBeats });
    beat += n.lengthBeats;
  }
  return { pattern, totalBeats: beat };
}
