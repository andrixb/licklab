// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { checkPlausibility } from "./plausibility.js";
import type { Lick } from "./lick.js";
import { validLick } from "./lick.test.js";

const lickOverDm7 = (pattern: Lick["pattern"]): Lick =>
  validLick({
    pattern,
    harmonicContext: {
      chords: [
        { symbol: "Dm7", beats: 4 },
        { symbol: "G7", beats: 4 },
      ],
      originalKey: "C",
      function: "ii-V-I major",
    },
  });

describe("plausibility", () => {
  it("chord-tone line over its chord: no warnings", () => {
    const lick = lickOverDm7([
      { steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 }, // D root
      { steps: 2, semitones: 3, octaveOffset: 0, startBeat: 1, durationBeats: 1 }, // F third
      { steps: 4, semitones: 7, octaveOffset: 0, startBeat: 2, durationBeats: 1 }, // A fifth
      { steps: 6, semitones: 10, octaveOffset: 0, startBeat: 3, durationBeats: 1 }, // C seventh
    ]);
    const report = checkPlausibility(lick);
    expect(report.ok).toBe(true);
    expect(report.chordToneRatio).toBe(1);
  });
  it("mostly-random notes warn (never throw/block)", () => {
    const lick = lickOverDm7([
      { steps: 1, semitones: 1, octaveOffset: 0, startBeat: 0, durationBeats: 0.5 }, // Eb-ish over Dm7…
      { steps: 3, semitones: 6, octaveOffset: 0, startBeat: 0.5, durationBeats: 0.5 }, // F#/b5 far from Dm7 tones
      { steps: 1, semitones: 2, octaveOffset: 1, startBeat: 1, durationBeats: 0.5 },
      { steps: 5, semitones: 8, octaveOffset: 0, startBeat: 1.5, durationBeats: 0.5 }, // G#/Ab over Dm7
      { steps: 3, semitones: 6, octaveOffset: 1, startBeat: 2, durationBeats: 0.5 },
    ]);
    const report = checkPlausibility(lick);
    expect(report.ok).toBe(false);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.chordToneRatio).toBeLessThan(0.5);
  });
  it("common tensions (9/11/13) count as explained", () => {
    const lick = lickOverDm7([
      { steps: 1, semitones: 2, octaveOffset: 0, startBeat: 0, durationBeats: 1 }, // E = 9th of Dm7
      { steps: 3, semitones: 5, octaveOffset: 0, startBeat: 1, durationBeats: 1 }, // G = 11th
    ]);
    expect(checkPlausibility(lick).ok).toBe(true);
  });
  it("single-note lick gets a gentle note", () => {
    const lick = lickOverDm7([{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 }]);
    expect(checkPlausibility(lick).warnings.join(" ")).toMatch(/Single-note/);
  });
});
