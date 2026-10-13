// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  chordTones,
  guideToneDegrees,
  parseChordSymbol,
} from "./chords.js";
import { pitchName } from "./pitch.js";

describe("parseChordSymbol", () => {
  it("parses common symbols, root keeps spelling", () => {
    expect(parseChordSymbol("Dm7").quality).toBe("min7");
    expect(parseChordSymbol("G7").quality).toBe("dom7");
    expect(parseChordSymbol("Cmaj7").quality).toBe("maj7");
    expect(parseChordSymbol("Eb°7").quality).toBe("dim7");
    expect(pitchName(parseChordSymbol("Eb°7").root)).toBe("Eb");
    expect(parseChordSymbol("F#m7b5").quality).toBe("hdim7");
    expect(parseChordSymbol("Bb7").quality).toBe("dom7");
    expect(parseChordSymbol("C").quality).toBe("maj7");
    expect(parseChordSymbol("Aø").quality).toBe("hdim7");
  });
  it("rejects garbage; tension suffixes fall back to core quality", () => {
    expect(() => parseChordSymbol("H7")).toThrow();
    expect(() => parseChordSymbol("")).toThrow();
    expect(() => parseChordSymbol("Cxyz")).toThrow();
    expect(parseChordSymbol("Cmaj9#11b13").quality).toBe("maj7");
    expect(parseChordSymbol("G13b9").quality).toBe("dom7");
  });
  it("property: all 12 roots parse for core qualities", () => {
    const roots = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    const quals = ["maj7", "m7", "7", "o7", "ø7", "m6", "6"];
    fc.assert(
      fc.property(fc.constantFrom(...roots), fc.constantFrom(...quals), (r, q) => {
        const parsed = parseChordSymbol(`${r}${q === "maj7" ? "" : q}`);
        expect(chordTones(parsed).length).toBeGreaterThanOrEqual(3);
      }),
    );
  });
});

describe("chordTones + guide tones", () => {
  it("Eb°7 tones spell from the symbol root", () => {
    const tones = chordTones(parseChordSymbol("Eb°7"));
    expect(tones.map((t) => t.semitones)).toEqual([0, 3, 6, 9]);
  });
  it("ii-V-I guide tones", () => {
    expect(guideToneDegrees(parseChordSymbol("Dm7")).third?.semitones).toBe(3);
    expect(guideToneDegrees(parseChordSymbol("G7")).seventh?.semitones).toBe(10);
    expect(guideToneDegrees(parseChordSymbol("Cmaj7")).seventh?.semitones).toBe(11);
  });
  it("every quality has sane tones; power chords have no third", () => {
    const symbols = ["Cmaj7", "C6", "Cm7", "Cm6", "Cm(maj7)", "C7", "C°7", "Cø7", "Caug", "C7sus"];
    for (const s of symbols) {
      const parsed = parseChordSymbol(s);
      const { third } = guideToneDegrees(parsed);
      expect(third?.semitones ?? -1).toBeGreaterThanOrEqual(3);
      expect(chordTones(parsed)[0]).toEqual({ steps: 0, semitones: 0 });
    }
    expect(guideToneDegrees(parseChordSymbol("C5")).third).toBeNull();
  });
});
