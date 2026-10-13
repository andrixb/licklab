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
import { samplerUrlsFor, type SampleVoice } from "./sampleMaps.js";

export type { SampleVoice } from "./sampleMaps.js";
export { BASS_SAMPLE_MAP, DRUM_SAMPLE_MAP, PIANO_SAMPLE_MAP, SAMPLE_BASE_URL } from "./sampleMaps.js";

interface SamplerEntry {
  readonly sampler: Sampler;
  /** Resolves when every sample buffer has decoded; rejects if any request fails. */
  readonly ready: Promise<Sampler>;
}

const loaded = new Map<SampleVoice, SamplerEntry>();

/** Build a Sampler plus a promise that settles only once its buffers are ready. */
function createSampler(voice: SampleVoice): SamplerEntry {
  const { urls, baseUrl } = samplerUrlsFor(voice);
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
      console.log(`[Tone] ${voice} sampler loaded`);
      resolve(sampler);
    },
    onerror: () => reject(new Error(`${voice} samples failed to load from ${baseUrl}`)),
  });
  return { sampler, ready };
}

/** Cached, awaited loader per voice: the first call fetches, later calls share it. */
function voiceSampler(voice: SampleVoice): Promise<Sampler> {
  const existing = loaded.get(voice);
  if (existing) return existing.ready;
  const entry = createSampler(voice);
  loaded.set(voice, entry);
  return entry.ready;
}

export function getBassSampler(): Promise<Sampler> {
  return voiceSampler("bass");
}

export function getDrumSampler(): Promise<Sampler> {
  return voiceSampler("drums");
}

export function getPianoSampler(): Promise<Sampler> {
  return voiceSampler("piano");
}

/** The lick voice: piano samples — a lick is a melodic line riding the band. */
export function getLickSampler(): Promise<Sampler> {
  return voiceSampler("lick");
}

export function disposeSamplers(): void {
  for (const entry of loaded.values()) entry.sampler.dispose();
  loaded.clear();
}

export function isSamplerLoaded(): boolean {
  return [...loaded.values()].some((entry) => entry.sampler.loaded);
}
