// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone/sampleMaps: pure note -> sample-file mapping for the band
// engine voices (ADR-018). No Tone, no Tone.Sampler construction here, so the
// mapping (and the files it points at) are unit-testable in plain node.
//
// Files live in `public/samples/<voice>/` (Vite copies `public/` verbatim into
// the build) and are served at `/samples/<voice>/`. Tone prefixes `urls` values
// with `baseUrl`, so the values must be BARE FILENAMES — a full path here
// double-prefixes and 404s (and the SPA fallback then serves index.html, which
// fails to decode and aborts loading).
//
// The pack is built from CC0 sources by `node scripts/build-samples.mjs`
// (VSCO 2 CE contrabass pizz + upright piano, Virtuosity Drums overhead mix).
// Notes between the sampled ones are repitched by Tone.

/** Sampler voices: pitched instruments plus one drum kit (keyed by GM notes). */
export type SampleVoice = "bass" | "drums" | "piano" | "lick";

/** URL path the app serves samples from (matches public/samples/). */
export const SAMPLE_BASE_URL = "/samples/";

/** The lick voice reuses the piano samples; it is a melodic line over the band. */
const SAMPLE_SUBDIR: Record<SampleVoice, string> = {
  bass: "bass",
  drums: "drums",
  piano: "piano",
  lick: "piano",
};

// Bass: VSCO 2 CE contrabass PIZZICATO (CC0), every 1-4 semitones over
// E1..A2 — the range `placeNear(.., 40)` uses, so Tone never has to repitch
// by more than 2 semitones (a large repitch is what makes a sampler sound
// synthetic). Anchors whose upstream source was muddy are themselves a verified
// neighbour transposed, see scripts/build-samples.mjs (which asserts every file
// sounds the note it is named for).
export const BASS_SAMPLE_MAP = {
  E1: "Contrabass_pizz_E1",
  "F#1": "Contrabass_pizz_Fs1",
  G1: "Contrabass_pizz_G1",
  "A#1": "Contrabass_pizz_As1",
  C2: "Contrabass_pizz_C2",
  D2: "Contrabass_pizz_D2",
  "F#2": "Contrabass_pizz_Fs2",
  "G#2": "Contrabass_pizz_Gs2",
  A2: "Contrabass_pizz_A2",
} as const;

// Drums: General MIDI note -> file. Several GM numbers alias the same file so
// the domain's alternate placements (e.g. 35/36 for kick) all sound. The jmove
// adapter's extras alias to family voices: side-stick (37) + toms
// (43/45/47/50) to snare until tom samples join the pack, china/splash (52/55)
// to crash, ride-bell (53) to ride.
export const DRUM_SAMPLE_MAP = {
  36: "Kick",
  35: "Kick",
  38: "Snare",
  37: "Snare",
  40: "Snare",
  43: "Snare",
  45: "Snare",
  47: "Snare",
  50: "Snare",
  42: "HiHat",
  44: "HiHat",
  46: "HiHat",
  51: "Ride",
  53: "Ride",
  59: "Ride",
  49: "Crash",
  52: "Crash",
  55: "Crash",
  57: "Crash",
} as const;

// Piano: VSCO 2 CE upright piano (CC0), medium velocity, every 4 semitones —
// the pack's own mapping; Tone fills the gaps. Runs up to C#6 because licks
// reach that high, and repitching by 7 semitones (the old F5 ceiling) was
// clearly audible.
export const PIANO_SAMPLE_MAP = {
  "C#3": "UprightPiano_Cs3",
  F3: "UprightPiano_F3",
  A3: "UprightPiano_A3",
  "C#4": "UprightPiano_Cs4",
  F4: "UprightPiano_F4",
  A4: "UprightPiano_A4",
  "C#5": "UprightPiano_Cs5",
  F5: "UprightPiano_F5",
  A5: "UprightPiano_A5",
  "C#6": "UprightPiano_Cs6",
} as const;

export function sampleMapFor(voice: SampleVoice): Record<string, string> {
  if (voice === "bass") return { ...BASS_SAMPLE_MAP };
  if (voice === "drums") return { ...DRUM_SAMPLE_MAP };
  return { ...PIANO_SAMPLE_MAP };
}

export interface SamplerUrls {
  /** Bare filenames, keyed by note name or GM note number (Tone joins baseUrl). */
  readonly urls: Record<string, string>;
  /** Directory the filenames resolve against (always ends with "/"). */
  readonly baseUrl: string;
}

/**
 * Tone.Sampler options for a voice: note -> "${filename}.wav" plus the
 * directory. Filenames only — Tone builds `baseUrl + filename` itself.
 */
export function samplerUrlsFor(voice: SampleVoice): SamplerUrls {
  const map = sampleMapFor(voice);
  const urls: Record<string, string> = {};
  for (const [note, filename] of Object.entries(map)) urls[note] = `${filename}.wav`;
  return { urls, baseUrl: `${SAMPLE_BASE_URL}${SAMPLE_SUBDIR[voice]}/` };
}

/** On-disk directory for a voice (public/samples/<dir>), for tooling/tests. */
export function sampleDirFor(voice: SampleVoice): string {
  return `public/samples/${SAMPLE_SUBDIR[voice]}`;
}
