// domain/pitch: chromatic pitch + key-aware enharmonic spelling.
// Pure: no framework/DOM imports. Spelling derives from scale degrees
// (letter arithmetic), never from a flat pc->name lookup, so Eb°7 spells
// Eb Gb Bbb Dbb — never D# F# A C.

export type NoteLetter = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export const LETTERS: readonly NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];

/** Natural semitone of each letter (C=0). */
const NATURAL_PC: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export type Accidental = -2 | -1 | 0 | 1 | 2;

export interface SpelledPitch {
  readonly letter: NoteLetter;
  readonly accidental: Accidental;
  readonly octave: number; // scientific pitch notation: C4 = middle C
}

export function pitchClassOf(p: SpelledPitch): number {
  return (((NATURAL_PC[p.letter] + p.accidental) % 12) + 12) % 12;
}

export function midiOf(p: SpelledPitch): number {
  // No mod-12 here: Cbb1 must sit a semitone below Cb1, not wrap into octave 2.
  return (p.octave + 1) * 12 + NATURAL_PC[p.letter] + p.accidental;
}

export function letterIndex(l: NoteLetter): number {
  const i = LETTERS.indexOf(l);
  if (i < 0) throw new Error(`invalid letter ${l}`);
  return i;
}

export interface DegreeOffset {
  /** Diatonic steps above the root letter (0 = unison, 2 = third, 6 = seventh). May exceed 6. */
  readonly steps: number;
  /** Semitones above the root pitch class (0-11+). */
  readonly semitones: number;
}

/**
 * Spell the pitch `semitones` above `root`, using the letter `steps` above
 * the root letter. The accidental is forced by the pitch difference, so
 * diminished/augmented qualities spell correctly (Bbb, Dbb, Ax, ...).
 */
export function spellDegree(root: SpelledPitch, degree: DegreeOffset): SpelledPitch {
  const rootIdx = letterIndex(root.letter);
  const totalSteps = rootIdx + degree.steps;
  const letter = LETTERS[((totalSteps % 7) + 7) % 7] as NoteLetter;
  const octave = root.octave + Math.floor(totalSteps / 7);
  const rootAbs = NATURAL_PC[root.letter] + root.accidental + root.octave * 12;
  // Absolute pitch of target, then accidental relative to the chosen letter/octave.
  const targetAbs = rootAbs + degree.semitones;
  const spelledNaturalAbs = NATURAL_PC[letter] + octave * 12;
  const acc = targetAbs - spelledNaturalAbs;
  if (acc < -2 || acc > 2 || !Number.isInteger(acc)) {
    throw new Error(`degree not spellable with single/double accidental (steps=${degree.steps}, semis=${degree.semitones})`);
  }
  return { letter, accidental: acc as Accidental, octave };
}

/** Recover the degree (steps + semitones) of `pitch` relative to `root`. */
export function degreeOf(root: SpelledPitch, pitch: SpelledPitch): DegreeOffset {
  const steps = letterIndex(pitch.letter) - letterIndex(root.letter) + (pitch.octave - root.octave) * 7;
  const semitones = midiOf(pitch) - midiOf(root);
  return { steps, semitones };
}

const ACC_SYMBOL: Record<Accidental, string> = {
  "-2": "bb",
  "-1": "b",
  "0": "",
  "1": "#",
  "2": "x",
};

/** "Eb", "F#x"? no — "F##" rendered "Fx": uses x for double-sharp. */
export function pitchName(p: SpelledPitch): string {
  return `${p.letter}${ACC_SYMBOL[p.accidental]}`;
}

export function parsePitchName(name: string, octave: number): SpelledPitch {
  const match = /^([A-Ga-g])(bb|b|#|x)?$/.exec(name.trim());
  if (!match?.[1]) throw new Error(`invalid pitch name: ${name}`);
  const letter = match[1].toUpperCase() as NoteLetter;
  const accStr = match[2] ?? "";
  const accidental = (accStr === "bb" ? -2 : accStr === "b" ? -1 : accStr === "#" ? 1 : accStr === "x" ? 2 : 0) as Accidental;
  return { letter, accidental, octave };
}
