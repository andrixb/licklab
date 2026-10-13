// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/band: deterministic backing-band generation (walking bass, comping,
// drums) as pure beat events. The AudioEngine adapter only schedules these;
// everything musical is testable without audio hardware.

import { CHORD_TONES, parseChordSymbol } from "./chords.js";
import type { FlatChord } from "./progression.js";
import { midiOf, spellDegree, letterIndex, pitchClassOf, type SpelledPitch } from "./pitch.js";
import type { SoundingNote } from "./transpose.js";

export type BandStyle = "swing" | "ballad" | "bossa" | "straight";
export const BAND_STYLES: readonly BandStyle[] = ["swing", "ballad", "bossa", "straight"];

export type Voice = "bass" | "piano" | "drums" | "lick";
export type DrumRole = "kick" | "snare" | "hat" | "ride" | "ride-bell" | "crash";

export interface BandEvent {
  readonly voice: Voice;
  /** Position in beats from chorus start (floats for swing eighths). */
  readonly timeBeats: number;
  readonly durationBeats: number;
  /** For pitched voices: spelled pitch + midi. Drums use fixed midi per role. */
  readonly pitch?: SpelledPitch;
  readonly midi?: number;
  readonly drum?: DrumRole;
  readonly accent?: boolean;
}

export interface BandPart {
  readonly bass: boolean;
  readonly piano: boolean;
  readonly drums: boolean;
  readonly tempoBpm: number;
}

const DRUM_MIDI: Record<DrumRole, number> = {
  kick: 36,
  snare: 38,
  hat: 42,
  ride: 51,
  "ride-bell": 53,
  crash: 49,
};

const drum = (voice: "drums", t: number, role: DrumRole, accent = false, durationBeats = 0.25): BandEvent => ({
  voice,
  timeBeats: t,
  durationBeats,
  drum: role,
  midi: DRUM_MIDI[role],
  accent,
});

/** Place a spelled pitch within `window` semitones of a target (octave adjust). */
function placeNear(p: SpelledPitch, targetMidi: number): SpelledPitch {
  let out = { ...p };
  while (midiOf(out) - targetMidi > 6) out = { ...out, octave: out.octave - 1 };
  while (targetMidi - midiOf(out) > 6) out = { ...out, octave: out.octave + 1 };
  return out;
}

export interface ChordUnder {
  readonly chord: FlatChord;
  readonly index: number;
}

function chordAt(flat: readonly FlatChord[], beat: number): ChordUnder {
  let acc = 0;
  for (let i = 0; i < flat.length; i++) {
    const c = flat[i] as FlatChord;
    if (beat < acc + c.beats - 1e-9 || i === flat.length - 1) return { chord: c, index: i };
    acc += c.beats;
  }
  throw new Error("empty progression");
}

const parsed = (symbol: string) => parseChordSymbol(symbol);

/**
 * Walking bass: one note per beat. Beat 1 lands on the chord root (jazz
 * rule), interior beats rotate chord tones, and the last beat of a chord
 * chromatically approaches the NEXT chord root (letter one step below,
 * accidental forced by pitch — correct spelling guaranteed by spellDegree).
 * Deterministic (no RNG) so it's testable and stable across replays.
 */
export function walkingLine(flat: readonly FlatChord[]): BandEvent[] {
  const out: BandEvent[] = [];
  const total = flat.reduce((n, c) => n + c.beats, 0);
  for (let beat = 0; beat < total - 1e-9; beat += 1) {
    const { chord, index } = chordAt(flat, beat);
    const pc = parsed(chord.symbol);
    const root = pc.root;
    const posInChord = beat - chord.startBeat;
    const tones = CHORD_TONES[pc.quality];
    let degree: { steps: number; semitones: number };
    if (posInChord < 1e-6) {
      degree = tones[0] ?? { steps: 0, semitones: 0 };
    } else if (Math.abs(posInChord - (chord.beats - 1)) < 1e-6 && index + 1 < flat.length) {
      const nextSymbol = flat[index + 1]?.symbol;
      if (!nextSymbol) {
        degree = tones[Math.min(1, tones.length - 1)] ?? { steps: 0, semitones: 0 };
      } else {
        const next = parsed(nextSymbol).root;
        const letterDiff = (letterIndex(next.letter) - letterIndex(root.letter) + 7) % 7;
        const pcDiff = (((pitchClassOf(next) - pitchClassOf(root)) % 12) + 12) % 12;
        // Chromatic below the next root: same letter class, one semitone lower.
        // Keep steps non-negative (spellDegree octave math expects that);
        // placeNear pulls the octave back down for the bass register.
        let steps = letterDiff - 1;
        if (steps < 0) steps += 7;
        degree = { steps, semitones: (pcDiff + 11) % 12 };
      }
    } else {
      degree = tones[Math.min(1 + (posInChord % 3), tones.length - 1)] ?? tones[0] ?? { steps: 0, semitones: 0 };
    }
    const spelled = placeNear(spellDegree(root, degree), 40);
    out.push({ voice: "bass", timeBeats: beat, durationBeats: 0.9, pitch: spelled, midi: midiOf(spelled) });
  }
  return out;
}

/** Rootless 3+7 piano voicings (guide-tone shells), octave-placed for comping. */
export function compingVoicings(flat: readonly FlatChord[], style: BandStyle): BandEvent[] {
  const out: BandEvent[] = [];
  for (const c of flat) {
    const pc = parsed(c.symbol);
    const tones = CHORD_TONES[pc.quality];
    const third = tones.find((t) => t.steps === 2 || t.steps === 3) ?? tones[1];
    const seventh = tones.find((t) => t.steps === 6 || t.steps === 5) ?? tones[tones.length - 1];
    if (!third || !seventh) continue;
    const hits: number[] =
      style === "bossa" ? [0, 1.5, 2.5] : style === "straight" ? [0, 1.5, 2, 3.5] : style === "ballad" ? [0] : [0, 2];
    for (const off of hits) {
      if (off >= c.beats - 1e-9 && off > 0) continue;
      for (const t of [third, seventh]) {
        const spelled = placeNear(spellDegree(pc.root, { steps: t.steps, semitones: t.semitones }), 62);
        out.push({ voice: "piano", timeBeats: c.startBeat + Math.min(off, c.beats - 0.25), durationBeats: 0.5, pitch: spelled, midi: midiOf(spelled) });
      }
    }
  }
  return out;
}

/** Deterministic drum grid per style for one chorus. Swing uses triplet eighths. */
export function drumGrid(flat: readonly FlatChord[], style: BandStyle): BandEvent[] {
  const total = flat.reduce((n, c) => n + c.beats, 0);
  const bars = total / 4;
  const out: BandEvent[] = [];
  const SWING_8 = 2 / 3; // "and" lands two triplet parts after the beat
  for (let bar = 0; bar < bars; bar++) {
    const b = bar * 4;
    if (style === "swing") {
      out.push(drum("drums", b, "ride-bell"), drum("drums", b + 1, "ride"), drum("drums", b + 1 + SWING_8, "ride"), drum("drums", b + 2, "ride"), drum("drums", b + 3, "ride"), drum("drums", b + 3 + SWING_8, "ride"));
      out.push(drum("drums", b + 1, "hat", true), drum("drums", b + 3, "hat", true));
      out.push(drum("drums", b, "kick", false), drum("drums", b + 2, "kick", false)); // feathered
      if (bar % 4 === 3) out.push(drum("drums", b + 3.5, "snare", false)); // fill on the turn
    } else if (style === "ballad") {
      for (let q = 0; q < 4; q++) out.push(drum("drums", b + q, "ride", q === 0));
      out.push(drum("drums", b + 1, "ride-bell"), drum("drums", b + 3, "ride-bell"));
    } else if (style === "bossa") {
      out.push(drum("drums", b, "kick", true), drum("drums", b + 1.5, "kick"), drum("drums", b + 2.5, "kick"));
      for (let e = 0; e < 8; e++) out.push(drum("drums", b + e * 0.5, "hat", e % 2 === 0));
      out.push(drum("drums", b + 0.75, "snare"), drum("drums", b + 1.75, "snare"), drum("drums", b + 2.5, "snare"), drum("drums", b + 3.25, "snare"), drum("drums", b + 3.75, "snare"));
      if (bar === 0) out.push(drum("drums", 0, "crash", true));
    } else {
      for (let e = 0; e < 8; e++) out.push(drum("drums", b + e * 0.5, "hat", e % 2 === 0));
      out.push(drum("drums", b, "kick", true), drum("drums", b + 2.5, "kick"), drum("drums", b + 1, "snare", true), drum("drums", b + 3, "snare", true));
    }
  }
  return out.filter((e) => e.timeBeats < total);
}

export interface ChorusPlan {
  readonly events: readonly BandEvent[];
  readonly totalBeats: number;
  readonly style: BandStyle;
}

export interface TimedEvent extends BandEvent {
  readonly timeSeconds: number;
  readonly durationSeconds: number;
}

/** Beat-grid → seconds (plus one-bar count-in). Pure so timing is testable
 *  without audio hardware (spec: never test scheduling by listening). */
export function toTimedEvents(plan: ChorusPlan, tempoBpm: number, countInBeats = 4): TimedEvent[] {
  if (!(tempoBpm > 0)) throw new Error("tempo must be positive");
  const spb = 60 / tempoBpm;
  return plan.events.map((e) => ({
    ...e,
    timeSeconds: (e.timeBeats + countInBeats) * spb,
    durationSeconds: e.durationBeats * spb,
  }));
}

/** Total playhead length including count-in, in seconds. */
export function chorusSeconds(plan: ChorusPlan, tempoBpm: number, countInBeats = 4): number {
  return ((plan.totalBeats + countInBeats) * 60) / tempoBpm;
}

/** Full one-chorus plan (band parts gated by `part`, plus a solo-chorus line). */
export function buildChorus(flat: readonly FlatChord[], style: BandStyle, part: BandPart, lickLine?: readonly SoundingNote[]): ChorusPlan {
  const totalBeats = flat.reduce((n, c) => n + c.beats, 0);
  const events: BandEvent[] = [
    ...(part.drums ? drumGrid(flat, style) : []),
    ...(part.bass ? walkingLine(flat) : []),
    ...(part.piano ? compingVoicings(flat, style) : []),
  ];
  for (const n of lickLine ?? []) {
    if (!n.pitch) continue;
    events.push({ voice: "lick", timeBeats: n.startBeat, durationBeats: n.durationBeats, pitch: n.pitch, midi: midiOf(n.pitch) });
  }
  events.sort((a, b) => a.timeBeats - b.timeBeats || a.voice.localeCompare(b.voice));
  return { events, totalBeats, style };
}

/**
 * Solo chorus: place lick notes onto the timeline at their segments.
 * Each placement supplies the target root (caller transposed via transposeLick).
 */
export function placeLickOnBeat(line: readonly SoundingNote[], offsetBeats: number): SoundingNote[] {
  return line.map((n) => ({ ...n, startBeat: n.startBeat + offsetBeats }));
}
