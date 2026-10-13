import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  abcNoteToken,
  abcToPattern,
  parseAbcNotes,
  soundingToAbc,
  AbcError,
} from "./abc.js";
import { parseChordSymbol } from "./chords.js";
import { validLick } from "./lick.test.js";
import { transposeLick } from "./transpose.js";

describe("abcNoteToken", () => {
  it("spells explicit accidentals + octaves (C = middle C)", () => {
    expect(abcNoteToken({ letter: "E", accidental: -1, octave: 4 })).toBe("_E");
    expect(abcNoteToken({ letter: "B", accidental: -2, octave: 3 })).toBe("__B,");
    expect(abcNoteToken({ letter: "D", accidental: -2, octave: 3 })).toBe("__D,");
    expect(abcNoteToken({ letter: "C", accidental: 0, octave: 5 })).toBe("=c");
    expect(abcNoteToken({ letter: "G", accidental: 1, octave: 4 })).toBe("^G");
  });
});

describe("parseAbcNotes", () => {
  it("parses notes, lengths, rests, bars", () => {
    const notes = parseAbcNotes("X:1\nL:1/8\nK:C\n_D E2 z | G/2A3/2 |]");
    expect(notes.map((n) => [n.letter, n.lengthBeats, n.rest])).toEqual([
      ["D", 0.5, false],
      ["E", 1, false],
      ["z", 0.5, true],
      ["G", 0.25, false],
      ["A", 0.75, false],
    ]);
    expect(notes[0]?.accidental).toBe(-1);
  });
  it("rejects empty music", () => {
    expect(() => parseAbcNotes("X:1\nK:C\n")).toThrow(AbcError);
  });
});

describe("abc round trip", () => {
  it("lick -> ABC -> pattern preserves shape", () => {
    const lick = validLick();
    const root = parseChordSymbol("Dm7").root;
    const sounding = transposeLick(lick, root);
    const abc = soundingToAbc(sounding, { title: lick.title });
    expect(abc).toContain("T:Cry Me a River");
    const { pattern } = abcToPattern(parseAbcNotes(abc), root);
    expect(pattern.map((p) => [p.semitones, p.startBeat, p.durationBeats])).toEqual(
      lick.pattern.map((p) => [p.semitones, p.startBeat, p.durationBeats]),
    );
  });
  it("property: entry over all 12 roots keeps semitone classes", () => {
    const roots = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    fc.assert(
      fc.property(fc.constantFrom(...roots), (r) => {
        const root = parseChordSymbol(`${r}7`).root;
        const { pattern } = abcToPattern(parseAbcNotes("_D E F G |"), root);
        expect(pattern).toHaveLength(4);
        for (const p of pattern) {
          expect(p.semitones).toBeGreaterThanOrEqual(0);
          expect(p.semitones).toBeLessThanOrEqual(11);
        }
      }),
    );
  });
});
