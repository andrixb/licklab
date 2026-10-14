// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone/schedule: pure mapping from domain TimedEvents to Tone
// "playback instructions" (instrument + note + time + duration + velocity).
// Kept separate from the Tone glue so timing/voice logic is unit-testable
// with no Web Audio (spec: never test scheduling by listening).

import type { TimedEvent, Voice } from "../../domain/band.js";

export type Instrument = "bass" | "piano" | "kick" | "snare" | "hat" | "ride" | "rideBell" | "crash" | "lick";

/** Which loaded sampler voice an instruction plays through. */
export type SamplerVoice = "bass" | "piano" | "drums" | "lick";

const DRUM_INSTRUMENT: Record<string, Instrument> = {
  kick: "kick",
  snare: "snare",
  hat: "hat",
  ride: "ride",
  "ride-bell": "rideBell",
  crash: "crash",
};

/**
 * All percussion instruments share ONE drum sampler (keyed by GM note); only
 * bass/piano/lick have their own. Pure, so routing is unit-testable without
 * loading a single sample.
 */
export function voiceForInstrument(instrument: Instrument): SamplerVoice {
  if (instrument === "bass" || instrument === "piano" || instrument === "lick") return instrument;
  return "drums";
}

export interface PlaybackInstruction {
  readonly instrument: Instrument;
  /** MIDI number (pitched voices from the domain's spelled math; drums per GM). */
  readonly note: number;
  readonly timeSeconds: number;
  readonly durationSeconds: number;
  readonly velocity: number;
}

/** Deterministic 0..1 hash (no RNG — velocities stable across replays). */
function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

/** ±amount deterministic variation from a quantized time key. */
function humanize(timeSeconds: number, amount: number, salt: number): number {
  const key = Math.round(timeSeconds * 100) + salt * 7919;
  return (hash01(key) - 0.5) * 2 * amount;
}

function drumDuration(instrument: Instrument): number {
  switch (instrument) {
    case "kick":
      return 0.12;
    case "snare":
      return 0.18;
    case "hat":
      return 0.09;
    case "ride":
      return 0.5;
    case "rideBell":
      return 0.45;
    case "crash":
      return 1.8;
    default:
      return 0.15;
  }
}

/**
 * Jazz drum velocities: feathered kick, ghosted snare comping, chick hats on
 * 2&4, ride on-beats forward / triplet off-beats lighter. Accents always win.
 */
function drumVelocity(instrument: Instrument, accent: boolean, e: TimedEvent): number {
  if (accent) return 1;
  const frac = Math.abs(e.timeBeats % 1);
  const isOffBeat = frac > 0.2 && frac < 0.9;
  const v = humanize(e.timeSeconds, 0.05, e.midi ?? 0);
  switch (instrument) {
    case "kick":
      return 0.32 + v * 0.5; // felt, not heard
    case "snare":
      return (isOffBeat ? 0.34 : 0.5) + v * 0.5;
    case "hat":
      return 0.38 + v * 0.5;
    case "ride":
      return (isOffBeat ? 0.55 : 0.78) + v;
    case "rideBell":
      return 0.9 + v * 0.5;
    case "crash":
      return 0.9;
    default:
      return 0.55 + v * 0.5;
  }
}

function pitchedVelocity(voice: Voice, accent: boolean | undefined, e: TimedEvent): number {
  const v = humanize(e.timeSeconds, 0.04, e.midi ?? 0);
  if (voice === "lick") return 0.96 + v * 0.5;
  if (voice === "bass") return (accent ? 0.88 : 0.72) + v;
  // piano comping sits under the soloist
  return (accent ? 0.68 : 0.58) + v;
}

export function toPlaybackInstructions(events: readonly TimedEvent[]): PlaybackInstruction[] {
  return events.map((e) => {
    if (e.voice === "drums") {
      const instrument = DRUM_INSTRUMENT[e.drum ?? "kick"] ?? "kick";
      return {
        instrument,
        note: e.midi ?? 36,
        timeSeconds: e.timeSeconds,
        durationSeconds: drumDuration(instrument),
        velocity: drumVelocity(instrument, e.accent ?? false, e),
      };
    }
    const voice: Voice = e.voice;
    return {
      instrument: voice === "bass" ? "bass" : voice === "piano" ? "piano" : "lick",
      note: e.midi ?? 60,
      timeSeconds: e.timeSeconds,
      durationSeconds: Math.max(e.durationSeconds, 0.25),
      velocity: pitchedVelocity(voice, e.accent, e),
    };
  });
}
