// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { parseChordSymbol } from "./chords.js";
import { validLick } from "./lick.test.js";
import { midiOf, pitchName } from "./pitch.js";
import { fitBassRange, shiftOctave, transposeChordSymbol, transposeLick, transposeRoot } from "./transpose.js";

describe("transposeLick", () => {
  it("rejects licks with no context chords", () => {
    const lick = { ...validLick(), harmonicContext: { chords: [], originalKey: "C", function: "dom7" as const } };
    expect(() => transposeLick(lick, parseChordSymbol("C7").root)).toThrow();
  });
  it("re-roots a Dm7 lick onto Eb°7 with correct spelling", () => {
    const lick = validLick({
      harmonicContext: {
        chords: [{ symbol: "Eb°7", beats: 4 }],
        originalKey: "Eb",
        function: "dom7",
      },
      pattern: [
        { steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 },
        { steps: 2, semitones: 3, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
        { steps: 4, semitones: 6, octaveOffset: 0, startBeat: 2, durationBeats: 1 },
        { steps: 6, semitones: 9, octaveOffset: 0, startBeat: 3, durationBeats: 1 },
      ],
    });
    const target = parseChordSymbol("Eb°7").root;
    expect(transposeLick(lick, target).map((n) => pitchName(n.pitch))).toEqual(["Eb", "Gb", "Bbb", "Dbb"]);
  });
  it("property: transposition preserves semitone shape across all 12 roots", () => {
    const roots = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    fc.assert(
      fc.property(fc.constantFrom(...roots), (r) => {
        const lick = validLick();
        const target = parseChordSymbol(`${r}m7`).root;
        const notes = transposeLick(lick, target);
        const shape = notes.map((n) => midiOf(n.pitch) - midiOf(notes[0]?.pitch ?? { letter: "C", accidental: 0, octave: 4 }));
        expect(shape).toEqual([0, -3, -7]);
        for (const [i, n] of notes.entries()) {
          expect(n.startBeat).toBe(lick.pattern[i]?.startBeat);
          expect(n.durationBeats).toBe(lick.pattern[i]?.durationBeats);
        }
      }),
    );
  });
});

describe("shiftOctave", () => {
  it("shifts by whole octaves", () => {
    const notes = transposeLick(validLick(), parseChordSymbol("Dm7").root);
    const shifted = shiftOctave(notes, -1);
    expect(shifted[0]?.pitch.octave).toBe((notes[0]?.pitch.octave ?? 0) - 1);
    expect(() => shiftOctave(notes, 0.5)).toThrow();
  });
});

describe("transposeRoot", () => {
  it("rejects fractional shifts", () => {
    expect(() => transposeRoot(parseChordSymbol("C7").root, 0.5)).toThrow();
  });
  it("Bb view: C -> D; Eb view: C -> A", () => {
    expect(pitchName(transposeRoot(parseChordSymbol("C7").root, 2))).toBe("D");
    expect(pitchName(transposeRoot(parseChordSymbol("C7").root, 9))).toBe("A");
    expect(pitchName(transposeRoot(parseChordSymbol("Bb7").root, 2))).toBe("C");
    expect(pitchName(transposeRoot(parseChordSymbol("Eb7").root, 2))).toBe("F");
  });
  it("property: transposed root is exactly N semis above, all 12 roots x shifts", () => {
    const roots = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    fc.assert(
      fc.property(
        fc.constantFrom(...roots),
        fc.integer({ min: -12, max: 12 }),
        (r, n) => {
          const root = parseChordSymbol(`${r}7`).root;
          const t = transposeRoot(root, n);
          expect(midiOf(t) - midiOf(root)).toBe(n);
        },
      ),
    );
  });
});

describe("fitBassRange", () => {
  it("drops high lines into bass staff range", () => {
    const notes = transposeLick(validLick(), parseChordSymbol("Dm7").root);
    const fitted = fitBassRange(notes);
    const mean = fitted.reduce((n, x) => n + midiOf(x.pitch), 0) / fitted.length;
    expect(mean).toBeLessThanOrEqual(55);
    expect(fitted).toHaveLength(notes.length);
    expect(fitBassRange([])).toEqual([]);
  });
});

describe("transposeChordSymbol", () => {
  it("moves the root, keeps the suffix", () => {
    expect(transposeChordSymbol("Dm7", 2)).toBe("Em7");
    expect(transposeChordSymbol("Bb7", 2)).toBe("C7");
    expect(transposeChordSymbol("Cmaj7", 9)).toBe("Amaj7");
    expect(transposeChordSymbol("F#m7b5", -2)).toBe("Em7b5");
  });
});
