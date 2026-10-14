// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone/samplers: Tone.js samplers for band engine instruments (ADR-018).
// Samples are loaded lazily on first play and cached per voice.
//
// IMPORTANT: `Sampler.loaded` is only a BOOLEAN getter, so `await sampler.loaded`
// resolves immediately and does NOT wait for the buffers. Each loader below
// therefore wraps onload/onerror into a promise that settles only when every
// buffer has decoded — and rejects loudly (so the engine can bail) instead of
// leaving playback to trigger an empty buffer ("buffer is either not set or
// not loaded").

import { Sampler } from "tone";
import { samplerUrlsFor, type SampleVoice, type BassVariant, type PianoVariant, type DrumVariant } from "./sampleMaps.js";

export type { SampleVoice, BassVariant, PianoVariant, DrumVariant } from "./sampleMaps.js";
export { BASS_SAMPLE_MAP, DRUM_SAMPLE_MAP, PIANO_SAMPLE_MAP, SAMPLE_BASE_URL, 
         ELECTRIC_PIANO_SAMPLE_MAP, ACOUSTIC_BASS_SAMPLE_MAP, GRAND_PIANO_SAMPLE_MAP,
         CASIO_RZ1_DRUM_SAMPLE_MAP } from "./sampleMaps.js";

interface SamplerEntry {
  readonly sampler: Sampler;
  /** Resolves when every sample buffer has decoded; rejects if any request fails. */
  readonly ready: Promise<Sampler>;
}

/** Cache key includes voice + variant */
const loaded = new Map<string, SamplerEntry>();

/** Build a Sampler plus a promise that settles only once its buffers are ready. */
function createSampler(voice: SampleVoice, variant?: string): SamplerEntry {
  const { urls, baseUrl } = samplerUrlsFor(voice, variant);
  let resolve!: (s: Sampler) => void;
  let reject!: (e: Error) => void;
  const ready = new Promise<Sampler>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const sampler = new Sampler({
    urls,
    baseUrl,
    onload: () => {
      console.log(`[Tone] ${voice} (${variant || 'default'}) sampler loaded`);
      resolve(sampler);
    },
    onerror: () => reject(new Error(`${voice} (${variant || 'default'}) samples failed to load from ${baseUrl}`)),
  });
  return { sampler, ready };
}

/** Cached, awaited loader per voice+variant: the first call fetches, later calls share it. */
function voiceSampler(voice: SampleVoice, variant?: string): Promise<Sampler> {
  const cacheKey = variant ? `${voice}:${variant}` : voice;
  const existing = loaded.get(cacheKey);
  if (existing) return existing.ready;
  const entry = createSampler(voice, variant);
  loaded.set(cacheKey, entry);
  return entry.ready;
}

export function getBassSampler(variant?: BassVariant): Promise<Sampler> {
  return voiceSampler("bass", variant);
}

export function getDrumSampler(variant?: DrumVariant): Promise<Sampler> {
  return voiceSampler("drums", variant);
}

export function getPianoSampler(variant?: PianoVariant): Promise<Sampler> {
  return voiceSampler("piano", variant);
}

/** The lick voice reuses the piano samples; it is a melodic line riding the band. */
export function getLickSampler(variant?: PianoVariant): Promise<Sampler> {
  return voiceSampler("lick", variant);
}

export function disposeSamplers(): void {
  for (const entry of loaded.values()) entry.sampler.dispose();
  loaded.clear();
}

export function isSamplerLoaded(): boolean {
  return [...loaded.values()].some((entry) => entry.sampler.loaded);
}
