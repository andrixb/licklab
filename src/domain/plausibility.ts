// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/plausibility: author-side sanity check for a lick against its own
// declared chords. WARNS ONLY — outside sounds are a feature of jazz; this
// checks "looks inconsistent", not "is wrong". Pure, deterministic.

import { parseChordSymbol } from "./chords.js";
import { pitchClassOf } from "./pitch.js";
import { acceptableTones, bucketBeats } from "./signatures.js";
import type { Lick } from "./lick.js";

export interface PlausibilityReport {
  readonly ok: boolean;
  readonly warnings: readonly string[];
  /** Fraction of notes that are chord tones or stepwise approaches (0..1). */
  readonly chordToneRatio: number;
}

interface ChordWindow {
  readonly quality: ReturnType<typeof parseChordSymbol>["quality"];
  readonly rootPc: number;
  readonly start: number;
  readonly end: number;
}

function chordWindows(lick: Lick): ChordWindow[] {
  let beat = 0;
  return lick.harmonicContext.chords.map((c) => {
    const parsed = parseChordSymbol(c.symbol);
    const w: ChordWindow = { quality: parsed.quality, rootPc: pitchClassOf(parsed.root), start: beat, end: beat + c.beats };
    beat += c.beats;
    return w;
  });
}

const FIRST_CHORD_ROOT_PC = (lick: Lick): number => {
  const first = lick.harmonicContext.chords[0];
  if (!first) throw new Error("lick context has no chords");
  return pitchClassOf(parseChordSymbol(first.symbol).root);
};

/**
 * A note is "explained" if (relative to the chord under it) it is a chord
 * tone or a common tension. Majority-unexplained notes → warning (never a
 * block). Chromatic runs land near the threshold; that's acceptable for a
 * warn-only heuristic.
 */
export function checkPlausibility(lick: Lick): PlausibilityReport {
  const warnings: string[] = [];
  const windows = chordWindows(lick);
  const fallbackWindow = windows[windows.length - 1];
  if (!fallbackWindow) return { ok: true, warnings, chordToneRatio: 1 };
  const rootPc = FIRST_CHORD_ROOT_PC(lick);
  let explained = 0;
  for (const n of lick.pattern) {
    const w = windows.find((x) => n.startBeat >= x.start - 1e-9 && n.startBeat < x.end - 1e-9) ?? fallbackWindow;
    // Note pc relative to the chord root under it: degrees are relative to the
    // FIRST context chord; shift by the window root's offset from it.
    const offset = (((w.rootPc - rootPc) % 12) + 12) % 12;
    const pc = (((n.semitones - offset) % 12) + 12) % 12;
    if (acceptableTones(w.quality).has(pc)) explained++;
  }
  const chordToneRatio = lick.pattern.length === 0 ? 1 : explained / lick.pattern.length;
  if (chordToneRatio < 0.5) {
    warnings.push(
      `Only ${Math.round(chordToneRatio * 100)}% of notes line up with the declared chords — double-check the harmonic context (or keep them on purpose: outside lines are welcome).`,
    );
  }
  const beats = bucketBeats(lick.pattern.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0));
  const contextBeats = lick.harmonicContext.chords.reduce((n, c) => n + c.beats, 0);
  if (beats > contextBeats) warnings.push(`Pattern (${beats} beats) runs past the declared context (${contextBeats} beats).`);
  if (lick.pattern.length === 1) warnings.push("Single-note lick: fine as an exercise, thin as a phrase.");
  return { ok: warnings.length === 0, warnings, chordToneRatio };
}
