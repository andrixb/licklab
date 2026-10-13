// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone/samplers: Tone.js samplers for band engine instruments.
// Loads CC0/CC-BY samples lazily on first use.

import { Sampler } from "tone";

// ---- Sample mappings ----

// Bass: Contrabass pizzicato, 4 velocity layers (we have mf only for now)
export const BASS_SAMPLE_MAP = {
  C2: "Contrabass_pizz_mf_C2",
  D2: "Contrabass_pizz_mf_E2",  // E2 is 2 semitones up from D2
  E2: "Contrabass_pizz_mf_G2",  // G2 is 5 semitones up from E2
  F2: "Contrabass_pizz_mf_C3",  // C3 is 5 semitones up from F2
  G2: "Contrabass_pizz_mf_C3",  // Will be pitched
  A2: "Contrabass_pizz_mf_C3",
  B2: "Contrabass_pizz_mf_C3",
  C3: "Contrabass_pizz_mf_C3",
} as const;

// Drums: General MIDI mapping
export const DRUM_SAMPLE_MAP = {
  // Kick
  36: "Kick",
  35: "Kick",
  // Snare
  38: "Snare",
  40: "Snare",
  // Hi-hat
  42: "HiHat",
  44: "HiHat",
  46: "HiHat",
  // Ride
  51: "Ride",
  59: "Ride",
  // Crash
  49: "Crash",
  57: "Crash",
} as const;

// Piano: Salamander Grand Piano, chromatic from C3 to C5
export const PIANO_SAMPLE_MAP = {
  48: "SalamanderGrandPiano_C3",
  50: "SalamanderGrandPiano_D3",
  52: "SalamanderGrandPiano_E3",
  53: "SalamanderGrandPiano_F3",
  55: "SalamanderGrandPiano_G3",
  57: "SalamanderGrandPiano_A3",
  59: "SalamanderGrandPiano_B3",
  60: "SalamanderGrandPiano_C4",
  62: "SalamanderGrandPiano_D4",
  64: "SalamanderGrandPiano_E4",
  65: "SalamanderGrandPiano_F4",
  67: "SalamanderGrandPiano_G4",
  69: "SalamanderGrandPiano_A4",
  71: "SalamanderGrandPiano_B4",
  72: "SalamanderGrandPiano_C5",
} as const;

// ---- Sampler factory ----

let bassSampler: Sampler | null = null;
let drumSampler: Sampler | null = null;
let pianoSampler: Sampler | null = null;

const SAMPLE_BASE_URL = "/samples/";

function getSampleUrl(instrument: "bass" | "drums" | "piano", filename: string): string {
  return `${SAMPLE_BASE_URL}${instrument}/${filename}.wav`;
}

export async function getBassSampler(): Promise<Sampler> {
  if (bassSampler) return bassSampler;
  
  const urls: Record<string, string> = {};
  for (const [note, filename] of Object.entries(BASS_SAMPLE_MAP)) {
    urls[note] = getSampleUrl("bass", filename);
  }
  
  bassSampler = new Sampler({
    urls,
    baseUrl: SAMPLE_BASE_URL + "bass/",
    onload: () => console.log("[Tone] Bass sampler loaded"),
  });
  
  await bassSampler.loaded;
  return bassSampler;
}

export async function getDrumSampler(): Promise<Sampler> {
  if (drumSampler) return drumSampler;
  
  const urls: Record<string, string> = {};
  for (const [midi, filename] of Object.entries(DRUM_SAMPLE_MAP)) {
    urls[midi] = getSampleUrl("drums", filename);
  }
  
  drumSampler = new Sampler({
    urls,
    baseUrl: SAMPLE_BASE_URL + "drums/",
    onload: () => console.log("[Tone] Drum sampler loaded"),
  });
  
  await drumSampler.loaded;
  return drumSampler;
}

export async function getPianoSampler(): Promise<Sampler> {
  if (pianoSampler) return pianoSampler;
  
  const urls: Record<string, string> = {};
  for (const [midi, filename] of Object.entries(PIANO_SAMPLE_MAP)) {
    urls[midi] = getSampleUrl("piano", filename);
  }
  
  pianoSampler = new Sampler({
    urls,
    baseUrl: SAMPLE_BASE_URL + "piano/",
    onload: () => console.log("[Tone] Piano sampler loaded"),
  });
  
  await pianoSampler.loaded;
  return pianoSampler;
}

export function disposeSamplers(): void {
  bassSampler?.dispose();
  drumSampler?.dispose();
  pianoSampler?.dispose();
  bassSampler = drumSampler = pianoSampler = null;
}

export function isSamplerLoaded(): boolean {
  return !!(bassSampler?.loaded || drumSampler?.loaded || pianoSampler?.loaded);
}