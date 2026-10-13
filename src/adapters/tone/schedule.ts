// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone/schedule: pure mapping from domain TimedEvents to Tone
// "playback instructions" (instrument + note + time + duration + velocity).
// Kept separate from the Tone glue so timing/voice logic is unit-testable
// with no Web Audio (spec: never test scheduling by listening).

import type { TimedEvent, Voice } from "../../domain/band.js";

export type Instrument = "bass" | "piano" | "kick" | "snare" | "hat" | "ride" | "rideBell" | "crash" | "lick";

export interface PlaybackInstruction {
  readonly instrument: Instrument;
  /** MIDI number (pitched voices from the domain's spelled math; drums per GM). */
  readonly note: number;
  readonly timeSeconds: number;
  readonly durationSeconds: number;
  readonly velocity: number;
}

const DRUM_INSTRUMENT: Record<string, Instrument> = {
  kick: "kick",
  snare: "snare",
  hat: "hat",
  ride: "ride",
  "ride-bell": "rideBell",
  crash: "crash",
};

export function toPlaybackInstructions(events: readonly TimedEvent[]): PlaybackInstruction[] {
  return events.map((e) => {
    if (e.voice === "drums") {
      return {
        instrument: DRUM_INSTRUMENT[e.drum ?? "kick"] ?? "kick",
        note: e.midi ?? 36,
        timeSeconds: e.timeSeconds,
        durationSeconds: 0.15,
        velocity: e.accent ? 1 : 0.55,
      };
    }
    const voice: Voice = e.voice;
    return {
      instrument: voice === "bass" ? "bass" : voice === "piano" ? "piano" : "lick",
      note: e.midi ?? 60,
      timeSeconds: e.timeSeconds,
      durationSeconds: e.durationSeconds,
      velocity: voice === "lick" ? 1 : 0.8,
    };
  });
}
