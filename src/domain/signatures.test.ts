// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  bucketBeats,
  chordQualityOf,
  contextKeyOf,
  familyOf,
  fifthStep,
  fnv1a64,
  functionKeyOf,
  patternHashOf,
  signatureOf,
  signaturesOf,
} from "./signatures.js";
import { transposeChordSymbol } from "./transpose.js";
import type { LickChord } from "./lick.js";

const chords = (...symbols: string[]): LickChord[] => symbols.map((symbol) => ({ symbol, beats: 4 }));

/** Transpose every chord symbol by `n` semitones (same direction for all). */
const transpose = (cs: LickChord[], n: number): LickChord[] => cs.map((c) => ({ symbol: transposeChordSymbol(c.symbol, n), beats: c.beats }));

describe("signatures.contextKey", () => {
  it("is identical for ii-V-I in all 12 keys", () => {
    const base = chords("Dm7", "G7", "Cmaj7");
    const expected = contextKeyOf(base);
    for (let n = 0; n < 12; n++) {
      expect(contextKeyOf(transpose(base, n))).toBe(expected);
    }
  });
  it("differs by durations and by quality, not by spelling", () => {
    expect(contextKeyOf(chords("Dm7", "G7"))).not.toBe(
      contextKeyOf([
        { symbol: "Dm7", beats: 2 },
        { symbol: "G7", beats: 6 },
      ]),
    );
    // Enharmonic roots spell the same contextKey (Ebb == D, Abb == G).
    expect(contextKeyOf(chords("Dm7", "G7"))).toBe(contextKeyOf(chords("Ebbm7", "Abb7")));
  });
  it("property: contextKey invariant under transposition of the whole context", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 11 }), (n) => {
        const base = chords("Cmaj7", "Am7", "Dm7", "G7");
        expect(contextKeyOf(transpose(base, n))).toBe(contextKeyOf(base));
      }),
    );
  });
});

describe("signatures.functionKey", () => {
  it("recognizes canonical patterns", () => {
    expect(functionKeyOf(chords("Dm7", "G7", "Cmaj7"))).toBe("ii-V-I.maj");
    expect(functionKeyOf(chords("Em7", "A7", "Dmaj7"))).toBe("ii-V-I.maj");
    expect(functionKeyOf(chords("Dm7b5", "G7", "Cm7"))).toBe("ii-V-i.min");
    expect(functionKeyOf(chords("E7", "Am7"))).toBe("V-I.min"); // V of A minor, down a fifth
    expect(functionKeyOf(chords("Cmaj7", "Am7", "Dm7", "G7"))).toBe("turnaround.maj");
    expect(functionKeyOf(chords("E7", "A7", "D7"))).toBe("cycle.of-fifths");
  });
  it("single chords map to static/dom", () => {
    expect(functionKeyOf(chords("Cmaj7"))).toBe("static.maj");
    expect(functionKeyOf(chords("Am7"))).toBe("static.min");
    expect(functionKeyOf(chords("G7"))).toBe("dom");
    expect(functionKeyOf(chords("Fm7b5"))).toBe("static.halfdim");
  });
  it("V-I.tritone: subV resolves down a half step", () => {
    expect(functionKeyOf(chords("Db7", "Cmaj7"))).toBe("V-I.tritone");
    expect(functionKeyOf(chords("Ab7", "Gm7"))).toBe("V-I.tritone");
  });
  it("unknown multi-chord sequences fall back to other", () => {
    expect(functionKeyOf(chords("Cmaj7", "F#maj7"))).toBe("other");
  });
  it("property: functionKey invariant under transposition", () => {
    const patterns = [chords("Dm7", "G7", "Cmaj7"), chords("Cmaj7", "Am7", "Dm7", "G7"), chords("Db7", "Cmaj7"), chords("G7")];
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 11 }), (n) => {
        for (const p of patterns) expect(functionKeyOf(transpose(p, n))).toBe(functionKeyOf(p));
      }),
    );
  });
});

describe("signatures.helpers", () => {
  it("fifthStep: descending fifth (V->I, ii->V) is +1, ascending fourth is -1", () => {
    expect(fifthStep(7, 0)).toBe(1); // G -> C (down a fifth)
    expect(fifthStep(2, 7)).toBe(1); // D -> G (down a fifth)
    expect(fifthStep(5, 0)).toBe(-1); // F -> C (up a fourth)
  });
  it("chordQuality only for single-chord contexts", () => {
    expect(chordQualityOf(chords("Dm7"))).toBe("min7");
    expect(chordQualityOf(chords("Dm7", "G7"))).toBeNull();
  });
  it("bucketBeats rounds to quarter grid", () => {
    expect(bucketBeats(3.9)).toBe(4);
    expect(bucketBeats(4.2)).toBe(4.25);
  });
  it("familyOf covers every quality", () => {
    expect(familyOf("maj7")).toBe("maj");
    expect(familyOf("hdim7")).toBe("halfdim");
    expect(familyOf("dim7")).toBe("dim");
    expect(familyOf("aug")).toBe("dom");
    expect(familyOf("power5")).toBe("dom");
    expect(familyOf("minmaj7")).toBe("min");
    expect(familyOf("maj6")).toBe("maj");
  });
  it("signatureOf throws on empty", () => {
    expect(() => signatureOf([])).toThrow();
  });
  it("fnv1a64 is deterministic and 16 hex chars", () => {
    expect(fnv1a64("abc")).toBe(fnv1a64("abc"));
    expect(fnv1a64("abc")).toHaveLength(16);
    expect(fnv1a64("abc")).not.toBe(fnv1a64("abd"));
  });
  it("patternHash canonicalizes octave spelling via parseLick upstream; stable here", () => {
    const notes = [{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 }];
    const key = contextKeyOf(chords("Dm7"));
    expect(patternHashOf(notes, key)).toBe(patternHashOf(notes, key));
  });
  it("signaturesOf returns all three fields", () => {
    const s = signaturesOf(chords("Dm7", "G7", "Cmaj7"));
    expect(s.chordQuality).toBeNull();
    expect(s.functionKey).toBe("ii-V-I.maj");
    expect(s.contextKey).toBe(contextKeyOf(chords("Dm7", "G7", "Cmaj7")));
  });
});
