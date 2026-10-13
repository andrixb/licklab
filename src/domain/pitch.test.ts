import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  degreeOf,
  LETTERS,
  letterIndex,
  midiOf,
  parsePitchName,
  pitchClassOf,
  pitchName,
  spellDegree,
  type Accidental,
  type NoteLetter,
  type SpelledPitch,
} from "./pitch.js";

const letterArb = fc.constantFrom(...LETTERS);
const accArb = fc.constantFrom(-2, -1, 0, 1, 2) as fc.Arbitrary<Accidental>;
const pitchArb: fc.Arbitrary<SpelledPitch> = fc.record({
  letter: letterArb,
  accidental: accArb,
  octave: fc.integer({ min: 1, max: 6 }),
});

describe("pitchClassOf/midiOf", () => {
  it("middle C", () => {
    expect(midiOf({ letter: "C", accidental: 0, octave: 4 })).toBe(60);
    expect(pitchClassOf({ letter: "E", accidental: -1, octave: 4 })).toBe(3);
  });
  it("letterIndex rejects invalid letters", () => {
    expect(() => letterIndex("H" as never)).toThrow();
  });
});

describe("spellDegree", () => {
  it("Eb°7 spells Eb Gb Bbb Dbb (not D#°7)", () => {
    const root: SpelledPitch = { letter: "E", accidental: -1, octave: 3 };
    const names = [
      { steps: 0, semitones: 0 },
      { steps: 2, semitones: 3 },
      { steps: 4, semitones: 6 },
      { steps: 6, semitones: 9 },
    ].map((d) => pitchName(spellDegree(root, d)));
    expect(names).toEqual(["Eb", "Gb", "Bbb", "Dbb"]);
  });
  it("C major triad", () => {
    const root: SpelledPitch = { letter: "C", accidental: 0, octave: 4 };
    expect(pitchName(spellDegree(root, { steps: 2, semitones: 4 }))).toBe("E");
    expect(pitchName(spellDegree(root, { steps: 4, semitones: 7 }))).toBe("G");
  });
  it("F# major third is A#; C# major third is E#", () => {
    const fSharp: SpelledPitch = { letter: "F", accidental: 1, octave: 4 };
    expect(pitchName(spellDegree(fSharp, { steps: 2, semitones: 4 }))).toBe("A#");
    const cSharp: SpelledPitch = { letter: "C", accidental: 1, octave: 4 };
    expect(pitchName(spellDegree(cSharp, { steps: 2, semitones: 4 }))).toBe("E#");
  });
  it("property: degree -> pitch -> degree round trip", () => {
    fc.assert(
      fc.property(pitchArb, fc.integer({ min: 0, max: 13 }), fc.integer({ min: 0, max: 24 }), (root, steps, semis) => {
        const degree = { steps, semitones: semis };
        let spelled: SpelledPitch;
        try {
          spelled = spellDegree(root, degree);
        } catch {
          return; // unspellable with double-accidental limit — acceptable
        }
        expect(degreeOf(root, spelled)).toEqual(degree);
        expect(midiOf(spelled) - midiOf(root)).toBe(semis);
      }),
    );
  });
});

describe("parsePitchName", () => {
  it("parses flats, sharps, doubles", () => {
    expect(parsePitchName("Eb", 3)).toEqual({ letter: "E", accidental: -1, octave: 3 });
    expect(parsePitchName("F#", 4)).toEqual({ letter: "F", accidental: 1, octave: 4 });
    expect(parsePitchName("Bbb", 2)).toEqual({ letter: "B", accidental: -2, octave: 2 });
    expect(parsePitchName("Ax", 5)).toEqual({ letter: "A", accidental: 2, octave: 5 });
    expect(parsePitchName("c", 4)).toEqual({ letter: "C", accidental: 0, octave: 4 });
  });
  it("rejects garbage", () => {
    expect(() => parsePitchName("H", 4)).toThrow();
    expect(() => parsePitchName("", 4)).toThrow();
  });
  it("property: pitchName round trip", () => {
    fc.assert(
      fc.property(pitchArb, (p) => {
        expect(parsePitchName(pitchName(p), p.octave)).toEqual(p);
      }),
    );
  });
});

export type { NoteLetter };
