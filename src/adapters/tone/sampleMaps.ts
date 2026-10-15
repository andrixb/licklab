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

/** Voice variants: multiple sound options per instrument (JMove-style selection). */
export type BassVariant = "upright" | "acoustic" | "electric";
export type PianoVariant = "upright" | "dx7" | "electric_piano" | "grand_piano";
export type DrumVariant = "jazz" | "machine";

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

// FluidR3 GM electric piano 2 (DX7 sound) - MIT license from FluidR3_GM
// Full chromatic range A0-C8, every semitone sampled
export const ELECTRIC_PIANO_SAMPLE_MAP: Record<string, string> = Object.fromEntries(
  ["A0","Bb0","B0","C1","Db1","D1","Eb1","E1","F1","Gb1","G1","Ab1",
   "A1","Bb1","B1","C2","Db2","D2","Eb2","E2","F2","Gb2","G2","Ab2",
   "A2","Bb2","B2","C3","Db3","D3","Eb3","E3","F3","Gb3","G3","Ab3",
   "A3","Bb3","B3","C4","Db4","D4","Eb4","E4","F4","Gb4","G4","Ab4",
   "A4","Bb4","B4","C5","Db5","D5","Eb5","E5","F5","Gb5","G5","Ab5",
   "A5","Bb5","B5","C6","Db6","D6","Eb6","E6","F6","Gb6","G6","Ab6",
   "A6","Bb6","B6","C7","Db7","D7","Eb7","E7","F7","Gb7","G7","Ab7",
   "A7","Bb7","B7","C8"].map(n => [n, n])
);

// FluidR3 GM acoustic bass - MIT license from FluidR3_GM
export const ACOUSTIC_BASS_SAMPLE_MAP: Record<string, string> = Object.fromEntries(
  ["C1","Db1","D1","Eb1","E1","F1","Gb1","G1","Ab1","A1","Bb1","B1",
   "C2","Db2","D2","Eb2","E2","F2","Gb2","G2","Ab2","A2","Bb2","B2",
   "C3","Db3","D3","Eb3","E3","F3","Gb3","G3","Ab3","A3","Bb3","B3",
   "C4"].map(n => [n, n])
);

// FluidR3 GM acoustic grand piano - MIT license from FluidR3_GM
export const GRAND_PIANO_SAMPLE_MAP: Record<string, string> = Object.fromEntries(
  ["A0","Bb0","B0","C1","Db1","D1","Eb1","E1","F1","Gb1","G1","Ab1",
   "A1","Bb1","B1","C2","Db2","D2","Eb2","E2","F2","Gb2","G2","Ab2",
   "A2","Bb2","B2","C3","Db3","D3","Eb3","E3","F3","Gb3","G3","Ab3",
   "A3","Bb3","B3","C4","Db4","D4","Eb4","E4","F4","Gb4","G4","Ab4",
   "A4","Bb4","B4","C5","Db5","D5","Eb5","E5","F5","Gb5","G5","Ab5",
   "A5","Bb5","B5","C6","Db6","D6","Eb6","E6","F6","Gb6","G6","Ab6",
   "A6","Bb6","B6","C7","Db7","D7","Eb7","E7","F7","Gb7","G7","Ab7",
   "A7","Bb7","B7","C8"].map(n => [n, n])
);

// Casio RZ-1 drum machine samples - CC0 public domain
export const CASIO_RZ1_DRUM_SAMPLE_MAP = {
  36: "kick",      // Bass Drum 1
  35: "kick",      // Acoustic Bass Drum
  38: "snare",     // Acoustic Snare
  37: "snare",     // Side Stick (rimshot)
  40: "snare",     // Electric Snare
  42: "hihat-closed", // Closed Hi-Hat
  44: "hihat-closed", // Pedal Hi-Hat
  46: "hihat-open",   // Open Hi-Hat
  49: "crash",     // Crash Cymbal 1
  51: "ride",      // Ride Cymbal 1
  55: "cowbell",   // Splash Cymbal
  56: "cowbell",   // Cowbell
  57: "crash",     // Crash Cymbal 2
  58: "cowbell",   // Tambourine
  69: "clave",     // Maracas
  75: "tom-1",     // Claves
  43: "tom-3",     // Low Floor Tom
  45: "tom-2",     // Low Tom
  47: "tom-1",     // Low-Mid Tom
  48: "tom-1",     // Hi-Mid Tom
  50: "tom-1",     // High Tom
  70: "tom-3",     // Maracas
} as const;

export function sampleMapFor(voice: SampleVoice, variant?: string): Record<string, string> {
  if (voice === "bass") {
    if (variant === "acoustic" || variant === "electric") return { ...ACOUSTIC_BASS_SAMPLE_MAP };
    // "upright" (default) uses the VSCO pizzicato pack
    return { ...BASS_SAMPLE_MAP };
  }
  if (voice === "drums") {
    if (variant === "machine") return { ...CASIO_RZ1_DRUM_SAMPLE_MAP };
    return { ...DRUM_SAMPLE_MAP };
  }
  // Piano variants: DX7 is the FluidR3 electric_piano_2 soundfont (same source
  // the demo's DX7 uses), not a separate FM synth.
  if (voice === "piano" || voice === "lick") {
    if (variant === "electric_piano" || variant === "dx7") return { ...ELECTRIC_PIANO_SAMPLE_MAP };
    if (variant === "grand_piano") return { ...GRAND_PIANO_SAMPLE_MAP };
    return { ...PIANO_SAMPLE_MAP };
  }
  return { ...PIANO_SAMPLE_MAP };
}

export interface SamplerUrls {
  /** Bare filenames, keyed by note name or GM note number (Tone joins baseUrl). */
  readonly urls: Record<string, string>;
  /** Directory the filenames resolve against (always ends with "/"). */
  readonly baseUrl: string;
}

/**
 * Tone.Sampler options for a voice: note -> "${filename}.wav" or ".ogg" plus the
 * directory. Filenames only — Tone builds `baseUrl + filename` itself.
 */
export function samplerUrlsFor(voice: SampleVoice, variant?: string): SamplerUrls {
  const map = sampleMapFor(voice, variant);
  const urls: Record<string, string> = {};
  const isFluidR3 = variant === "electric_piano" || variant === "dx7" || variant === "acoustic" || variant === "electric" || variant === "grand_piano";
  const isMachine = variant === "machine";
  // Casio RZ-1 pack ships as .ogg (same files the demo loads); everything
  // else in the pack is .wav. Requesting the wrong extension 404s, and the
  // SPA fallback would answer index.html (200 text/html) which fails to
  // decode — so the extension must match the files on disk.
  const ext = isMachine ? ".ogg" : ".wav";
  for (const [note, filename] of Object.entries(map)) urls[note] = `${filename}${ext}`;
  
  // Determine subdirectory based on variant
  let subdir = SAMPLE_SUBDIR[voice];
  if (isFluidR3) {
    if (variant === "electric_piano" || variant === "dx7") subdir = "fluidr3/electric_piano_2";
    else if (variant === "acoustic" || variant === "electric") subdir = "fluidr3/acoustic_bass";
    else if (variant === "grand_piano") subdir = "fluidr3/acoustic_grand_piano";
  } else if (isMachine) {
    subdir = "casio-rz1";
  }
  
  return { urls, baseUrl: `${SAMPLE_BASE_URL}${subdir}/` };
}

/** On-disk directory for a voice (public/samples/<dir>), for tooling/tests. */
export function sampleDirFor(voice: SampleVoice): string {
  return `public/samples/${SAMPLE_SUBDIR[voice]}`;
}
