// Copyright (C) 2026 Andrea Baldo
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
  /**
   * Explicit 0..1 velocity from the pattern source (e.g. the jmove adapter).
   * When absent the Tone schedule mapping derives velocity from role+accent.
   */
  readonly velocity?: number;
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

/** Deterministic 0..1 hash from an integer (no RNG — stable across replays). */
function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

function clampMidi(m: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, m));
}

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

/**
 * Chord sounding at `beat` (for playhead highlight). Pure lookup; returns
 * null outside the chorus so the UI can render an idle state.
 */
export function chordAtBeat(flat: readonly FlatChord[], beat: number): ChordUnder | null {
  if (flat.length === 0 || !(beat >= 0)) return null;
  const total = flat.reduce((n, c) => n + c.beats, 0);
  if (beat >= total) return null;
  return chordAt(flat, beat);
}

const parsed = (symbol: string) => parseChordSymbol(symbol);

/**
 * Walking bass: one note per beat. Beat 1 lands on the chord root (jazz
 * rule); interior beats walk chord tones + 9th with smooth voice-leading
 * (closest motion + deterministic tie-break, JJazzLab-style bass memory but
 * pure/functional); the last beat before a new chord chromatically approaches
 * the next root (even bars from below, odd bars from above for variety).
 * Deterministic (no RNG) so it's testable and stable across replays.
 */
export function walkingLine(flat: readonly FlatChord[]): BandEvent[] {
  const out: BandEvent[] = [];
  const total = flat.reduce((n, c) => n + c.beats, 0);
  let prevMidi: number | null = null;
  for (let beat = 0; beat < total - 1e-9; beat += 1) {
    const { chord, index } = chordAt(flat, beat);
    const pc = parsed(chord.symbol);
    const root = pc.root;
    const posInChord = beat - chord.startBeat;
    const tones = CHORD_TONES[pc.quality];
    const bar = Math.floor(beat / 4);
    const beatInBar = ((beat % 4) + 4) % 4;
    const accent = beatInBar === 0 || beatInBar === 2;
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
        // Even bars: chromatic below (classic); odd bars: chromatic above.
        // Keeps steps non-negative (spellDegree octave math expects that).
        if (bar % 2 === 0) {
          let steps = letterDiff - 1;
          if (steps < 0) steps += 7;
          degree = { steps, semitones: (pcDiff + 11) % 12 };
        } else {
          degree = { steps: (letterDiff + 1) % 7, semitones: (pcDiff + 1) % 12 };
        }
      }
    } else {
      // Interior: chord tones + 9th, scored by smoothness to prev + hash jitter.
      const candidates: { steps: number; semitones: number }[] = [...tones.slice(1)];
      candidates.push({ steps: 8, semitones: 14 }); // 9th color
      const target = clampMidi(prevMidi ?? 40, 33, 45);
      let best = candidates[0] ?? { steps: 0, semitones: 0 };
      let bestScore = Infinity;
      for (let ci = 0; ci < candidates.length; ci++) {
        const cand = candidates[ci] as { steps: number; semitones: number };
        let spelled: SpelledPitch;
        try {
          spelled = placeNear(spellDegree(root, cand), target);
        } catch {
          continue;
        }
        const m = midiOf(spelled);
        if (prevMidi !== null && m === prevMidi) continue; // no dead repeats
        const dist = prevMidi === null ? 0 : Math.abs(m - prevMidi);
        const jitter = hash01(bar * 131 + Math.round(beat) * 17 + ci * 31) * 2.5;
        const score = dist + jitter;
        if (score < bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      degree = best;
    }
    const target = clampMidi(prevMidi ?? 40, 33, 45);
    const spelled = placeNear(spellDegree(root, degree), target);
    const midi = midiOf(spelled);
    prevMidi = midi;
    out.push({ voice: "bass", timeBeats: beat, durationBeats: 0.9, pitch: spelled, midi, accent });
  }
  return out;
}

/**
 * Rootless piano comping with voice-leading (JJazzLab-style phrase adaption,
 * clean-room): 3-note shells (3rd + 7th + 9th/5th color) in a 54..74 window,
 * whole voicing shifted by octaves for minimal motion from the previous chord.
 * Rhythms are section-aware (Main A/B + sparse fill bar), deterministic.
 */
export function compingVoicings(flat: readonly FlatChord[], style: BandStyle): BandEvent[] {
  const out: BandEvent[] = [];
  let prevTop: number | null = null;
  for (const c of flat) {
    const pc = parsed(c.symbol);
    const tones = CHORD_TONES[pc.quality];
    const third = tones.find((t) => t.steps === 2 || t.steps === 3) ?? tones[1];
    const seventh = tones.find((t) => t.steps === 6 || t.steps === 5) ?? tones[tones.length - 1];
    if (!third || !seventh) continue;
    // Color tone: 9th for 4-note qualities, else 5th; fall back gracefully.
    const fifth = tones.find((t) => t.steps === 4);
    const colorPool: { steps: number; semitones: number }[] = [{ steps: 8, semitones: 14 }];
    if (fifth) colorPool.push({ steps: fifth.steps, semitones: fifth.semitones });
    let color: { steps: number; semitones: number } | null = null;
    for (const cand of colorPool) {
      try {
        spellDegree(pc.root, cand);
        color = cand;
        break;
      } catch {
        continue;
      }
    }
    const shell = color ? [third, seventh, color] : [third, seventh];
    const barIdx = Math.floor(c.startBeat / 4);
    const section = barIdx % 4;
    let hits: number[];
    let dur: number;
    if (style === "bossa") {
      hits = [0, 1.5, 2.5];
      dur = 0.7;
    } else if (style === "straight") {
      hits = [0, 1.5, 2, 3.5];
      dur = 0.6;
    } else if (style === "ballad") {
      hits = c.beats >= 4 ? [0, 2] : [0];
      dur = 2.2;
    } else {
      // swing: Main A ([0,2]) / Charleston ([0,1+2/3]) / anticipated ([0,2+2/3]) / sparse fill bar ([0])
      if (c.beats < 1.5) hits = [0];
      else if (section === 1) hits = [0, 1 + 2 / 3];
      else if (section === 2) hits = [0, 2 + 2 / 3];
      else if (section === 3) hits = [0];
      else hits = [0, 2];
      dur = 1.6;
    }
    for (const off of hits) {
      if (off >= c.beats - 1e-9 && off > 0) continue;
      const at = c.startBeat + Math.min(off, c.beats - 0.25);
      // Voice-lead: center near prevTop, then try octave shifts and keep the
      // one with minimal TOP-note motion (top-led comping voice-leading).
      const center = prevTop ?? 63;
      const placed = shell.map((t) => placeNear(spellDegree(pc.root, { steps: t.steps, semitones: t.semitones }), center));
      const baseMidis = placed.map((p) => midiOf(p));
      const baseTop = Math.max(...baseMidis);
      let shift = 0;
      if (prevTop !== null) {
        let bestShift = 0;
        let bestDist = Infinity;
        for (const s of [0, -12, 12, -24, 24]) {
          const top = baseTop + s;
          const all = baseMidis.map((m) => m + s);
          if (all.some((m) => m < 52 || m > 78)) continue;
          const dist = Math.abs(top - prevTop) + (s !== 0 ? 0.5 : 0);
          if (dist < bestDist) {
            bestDist = dist;
            bestShift = s;
          }
        }
        shift = bestShift;
      } else if (baseTop > 72) {
        shift = -12;
      }
      const isTop = barIdx % 8 === 0 && off === 0;
      let hitTop: number = prevTop ?? 0;
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i] as SpelledPitch;
        const m = (baseMidis[i] as number) + shift;
        const need = m - midiOf(p);
        const adj: SpelledPitch = { ...p, octave: p.octave + Math.round(need / 12) };
        const finalMidi = midiOf(adj);
        if (finalMidi > hitTop) hitTop = finalMidi;
        out.push({ voice: "piano", timeBeats: at, durationBeats: dur, pitch: adj, midi: finalMidi, accent: isTop });
      }
      prevTop = hitTop;
    }
  }
  return out;
}

/**
 * Deterministic drum grid per style for one chorus (JJazzLab-style sections,
 * clean-room): Main A/B alternate every 2 bars, Fill on every 4th bar, crash
 * marks the form top + every 8 bars. Swing keeps the classic spang-a-lang
 * triplet ride so the triplet-subdivision contract holds.
 */
export function drumGrid(flat: readonly FlatChord[], style: BandStyle): BandEvent[] {
  const total = flat.reduce((n, c) => n + c.beats, 0);
  const bars = total / 4;
  const out: BandEvent[] = [];
  const SWING_8 = 2 / 3; // "and" lands two triplet parts after the beat
  for (let bar = 0; bar < bars; bar++) {
    const b = bar * 4;
    const isFillBar = bar % 4 === 3;
    const isTop = bar % 8 === 0;
    if (style === "swing") {
      out.push(
        drum("drums", b, "ride-bell", isTop),
        drum("drums", b + 1, "ride"),
        drum("drums", b + 1 + SWING_8, "ride"),
        drum("drums", b + 2, "ride"),
        drum("drums", b + 3, "ride"),
        drum("drums", b + 3 + SWING_8, "ride"),
      );
      out.push(drum("drums", b + 1, "hat", true), drum("drums", b + 3, "hat", true));
      out.push(drum("drums", b, "kick", false), drum("drums", b + 2, "kick", false)); // feathered
      // Snare comping ghosts: one per 2 bars, alternating (quiet, accent=false).
      if (!isFillBar) {
        if (bar % 4 === 1) out.push(drum("drums", b + 2 + SWING_8, "snare", false));
        else if (bar % 4 === 2) out.push(drum("drums", b + 3 + SWING_8, "snare", false));
      } else {
        // Turnaround fill: triplet snares into the next section.
        out.push(drum("drums", b + 2 + SWING_8, "snare", false), drum("drums", b + 3, "snare", false), drum("drums", b + 3 + 1 / 3, "snare", false));
      }
      if (isTop) out.push(drum("drums", b, "crash", true));
    } else if (style === "ballad") {
      for (let q = 0; q < 4; q++) out.push(drum("drums", b + q, "ride", q === 0));
      out.push(drum("drums", b + 1, "ride-bell"), drum("drums", b + 3, "ride-bell"));
      if (bar % 2 === 1) out.push(drum("drums", b + 3, "snare", false)); // brush sweep
      if (isTop) out.push(drum("drums", b, "crash", true));
    } else if (style === "bossa") {
      out.push(drum("drums", b, "kick", true), drum("drums", b + 1.5, "kick"), drum("drums", b + 2.5, "kick"));
      for (let e = 0; e < 8; e++) out.push(drum("drums", b + e * 0.5, "hat", e % 2 === 0));
      out.push(drum("drums", b + 0.75, "snare"), drum("drums", b + 1.75, "snare"), drum("drums", b + 2.5, "snare"), drum("drums", b + 3.25, "snare"), drum("drums", b + 3.75, "snare"));
      if (bar === 0 || isTop) out.push(drum("drums", 0 + b, "crash", true));
    } else {
      for (let e = 0; e < 8; e++) out.push(drum("drums", b + e * 0.5, "hat", e % 2 === 0));
      out.push(drum("drums", b, "kick", true), drum("drums", b + 2.5, "kick"), drum("drums", b + 1, "snare", true), drum("drums", b + 3, "snare", true));
      if (isFillBar) out.push(drum("drums", b + 3.5, "snare", false));
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
