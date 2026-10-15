// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// chords.test: parity with JMove (@jmove/generator, pinned in package.json).
// The oracle is JMove itself — never a hand-written table: for every
// symbol, LickLab's reading must agree with JMove's parseQuality on
// family and core intervals. The quality list below is transcribed from
// JMove's own fixtures (tests/chordQuality.test.ts upstream) plus the
// alternative notations its normalize() documents.

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { classifyQuality, getChordIntervals, parseQuality } from "@jmove/generator";
import {
  chordTones,
  guideToneDegrees,
  parseChordSymbol,
  type ChordQuality,
} from "./chords.js";
import { pitchName } from "./pitch.js";

// Every quality JMove's own test suite pins, by family.
const JMOVE_KNOWN: ReadonlyArray<readonly [string, string]> = [
  ["", "major"], ["maj7", "major"], ["maj9", "major"], ["maj13", "major"],
  ["maj7#11", "major"], ["maj7#5", "major"], ["6", "major"], ["69", "major"],
  ["6/9", "major"], ["add9", "major"], ["5", "power"],
  ["m", "minor"], ["m7", "minor"], ["m9", "minor"], ["m6", "minor"],
  ["m6/9", "minor"], ["m(maj7)", "minor"], ["m11", "minor"],
  ["7", "dominant"], ["9", "dominant"], ["13", "dominant"],
  ["7b9", "dominant"], ["7#9", "dominant"], ["7b5", "dominant"],
  ["7#5", "dominant"], ["7alt", "dominant"], ["7b13", "dominant"],
  ["7#11", "dominant"], ["7b9b13", "dominant"], ["7#9b13", "dominant"],
  ["7b9#11", "dominant"], ["7#9#11", "dominant"], ["7#9b5", "dominant"],
  ["7b9b5", "dominant"], ["aug7", "dominant"],
  ["sus4", "suspended"], ["7sus", "suspended"], ["7sus4", "suspended"],
  ["9sus4", "suspended"], ["13sus4", "suspended"], ["sus2", "suspended"],
  ["dim", "diminished"], ["dim7", "diminished"], ["m7b5", "halfDiminished"],
  ["aug", "augmented"],
];

// iReal/unicode aliases JMove's normalize() documents (upstream tests).
const JMOVE_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["o", "diminished"], ["o7", "diminished"], ["h", "halfDiminished"],
  ["h7", "halfDiminished"], ["0", "halfDiminished"], ["07", "halfDiminished"],
  ["ø", "halfDiminished"], ["ø7", "halfDiminished"], ["^7", "major"],
  ["^", "major"], ["+", "augmented"], ["+7", "dominant"], ["-", "minor"],
  ["-7", "minor"], ["-9", "minor"], ["-11", "minor"], ["-(maj7)", "minor"],
  ["-^7", "minor"], ["-maj7", "minor"], ["-6", "minor"], ["-69", "minor"],
];

// Notations JMove 1.5.1 misreads without LickLab's documented alias layer
// (each probed against the pinned package; see ADR-023).
const ALIASED: ReadonlyArray<readonly [string, string, string]> = [
  // [input quality, canonical JMove quality, expected family]
  ["°7", "o7", "diminished"],
  ["°", "o", "diminished"],
  ["Δ7", "maj7", "major"],
  ["Δ", "maj7", "major"],
  ["M7", "maj7", "major"],
  ["MMaj7", "maj7", "major"],
  ["mMaj7", "m(maj7)", "minor"],
  ["power5", "5", "power"],
  ["7+", "7#5", "dominant"],
  ["alt", "7alt", "dominant"],
];

const ROOTS = ["Bb", "Eb", "F", "C", "G", "F#", "Db"];

describe("parseChordSymbol defers to JMove", () => {
  it("every JMove-known quality parses with JMove's family on every test root", () => {
    for (const root of ROOTS) {
      for (const [q, family] of [...JMOVE_KNOWN, ...JMOVE_ALIASES]) {
        const symbol = `${root}${q}`;
        const parsed = parseChordSymbol(symbol);
        expect(classifyQuality(parsed.jmoveQuality), symbol).toBe(family);
        expect(parsed.symbol).toBe(symbol);
      }
    }
  });
  it("LickLab aliases resolve to JMove-canonical qualities JMove reads correctly", () => {
    for (const root of ROOTS) {
      for (const [q, canonical, family] of ALIASED) {
        const parsed = parseChordSymbol(`${root}${q}`);
        expect(parsed.jmoveQuality, q).toBe(canonical);
        expect(classifyQuality(parsed.jmoveQuality), q).toBe(family);
      }
    }
  });
  it("extensions and alterations survive verbatim (never simplified to the core)", () => {
    for (const q of ["7#9", "7b9", "13", "9", "7alt", "7#9#5", "7b9b13", "m9", "m11", "m13", "maj9#11"]) {
      expect(parseChordSymbol(`Bb${q}`).jmoveQuality, q).toBe(q);
    }
  });
  it("slash bass parses (JMove strips it for generation; bass follows the root)", () => {
    for (const [symbol, root, bass] of [["Bb7/D", "Bb", "D"], ["C/E", "C", "E"], ["Dm7/G", "D", "G"]] as const) {
      const parsed = parseChordSymbol(symbol);
      expect(pitchName(parsed.root)).toBe(root);
      expect(parsed.slashBass && pitchName(parsed.slashBass)).toBe(bass);
      // The generator input keeps the core quality: JMove's normalize()
      // strips "/X" itself, so passing it through is identical — and the
      // same ChordEvent shape JMove's own demo builds.
      expect(parsed.jmoveQuality).toBe(symbol.slice(root.length).split("/")[0]);
    }
    // "6/9" is a quality, not a slash chord (JMove's own rule).
    expect(parseChordSymbol("C6/9").jmoveQuality).toBe("6/9");
    expect(parseChordSymbol("C6/9").slashBass).toBeNull();
  });
  it("root keeps its spelling, sharps and flats alike", () => {
    expect(pitchName(parseChordSymbol("F#m7b5").root)).toBe("F#");
    expect(pitchName(parseChordSymbol("Eb°7").root)).toBe("Eb");
    expect(pitchName(parseChordSymbol("Dbmaj7").root)).toBe("Db");
  });
  it("rejects non-note roots; JMove-total qualities are accepted as JMove reads them", () => {
    expect(() => parseChordSymbol("H7")).toThrow();
    expect(() => parseChordSymbol("")).toThrow();
    // JMove never throws on a quality string (algorithmic fallback): "Cxyz"
    // reads as a major triad, exactly as JMove's parseQuality does.
    expect(parseQuality("xyz").family).toBe("major");
    expect(parseChordSymbol("Cxyz").quality).toBe("maj7");
  });
  it("property: all test roots parse for core JMove qualities", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROOTS),
        fc.constantFrom(...JMOVE_KNOWN.map(([q]) => q)),
        (r, q) => {
          const parsed = parseChordSymbol(`${r}${q}`);
          expect(chordTones(parsed).length).toBeGreaterThanOrEqual(2);
        },
      ),
    );
  });
});

describe("storage categories stay stable (D1 columns + signature keys)", () => {
  const cases: ReadonlyArray<readonly [string, ChordQuality]> = [
    ["Dm7", "min7"], ["G7", "dom7"], ["Cmaj7", "maj7"], ["Eb°7", "dim7"],
    ["F#m7b5", "hdim7"], ["Bb7", "dom7"], ["C", "maj7"], ["Aø", "hdim7"],
    ["C6", "maj6"], ["Cm6", "min6"], ["Cm(maj7)", "minmaj7"], ["Caug", "aug"],
    ["C7sus", "sus7"], ["C5", "power5"], ["Cmaj9#11b13", "maj7"], ["G13b9", "dom7"],
  ];
  for (const [symbol, quality] of cases) {
    it(`${symbol} -> ${quality}`, () => {
      expect(parseChordSymbol(symbol).quality).toBe(quality);
    });
  }
});

describe("chordTones + guide tones come from JMove intervals", () => {
  it("core tones equal JMove's intervals for every storage category", () => {
    const canonical: Record<ChordQuality, string> = {
      maj7: "maj7", maj6: "6", min7: "m7", min6: "m6", minmaj7: "m(maj7)",
      dom7: "7", dim7: "dim7", hdim7: "m7b5", aug: "aug", sus7: "7sus", power5: "5",
    };
    for (const [quality, q] of Object.entries(canonical) as [ChordQuality, string][]) {
      const parsed = parseChordSymbol(`C${q === "" ? "" : q}`);
      expect(chordTones(parsed).map((t) => t.semitones), quality).toEqual(getChordIntervals(q));
    }
  });
  it("ii-V-I guide tones (task ground truth: dom7 = R,3,5,b7)", () => {
    expect(guideToneDegrees(parseChordSymbol("Dm7")).third?.semitones).toBe(3);
    expect(guideToneDegrees(parseChordSymbol("G7")).seventh?.semitones).toBe(10);
    expect(guideToneDegrees(parseChordSymbol("Cmaj7")).seventh?.semitones).toBe(11);
  });
  it("power chords have no third", () => {
    expect(guideToneDegrees(parseChordSymbol("C5")).third).toBeNull();
  });
});
