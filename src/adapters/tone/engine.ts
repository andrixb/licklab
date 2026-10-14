// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone: AudioEngine via Tone.js Transport (never setTimeout for
// audio). The ~200KB tone module loads lazily on first play to stay out of the
// initial payload (budget check). Sample-based voices (CC0/CC-BY) load on first
// play; Tone.Transport schedules all events. Nothing is triggered before its
// sampler's buffers have decoded (guaranteed by the `ready` promises in
// ./samplers — `Sampler.loaded` is only a boolean, never an awaitable).

import type { AudioEngine, BandPlayback } from "../../application/ports.js";
import type { TimedEvent } from "../../domain/band.js";
import { toPlaybackInstructions, voiceForInstrument, type PlaybackInstruction } from "./schedule.js";
import { getBassSampler, getDrumSampler, getLickSampler, getPianoSampler } from "./samplers.js";

type ToneModule = typeof import("tone");

interface SamplerVoiceSet {
  bass: InstanceType<ToneModule["Sampler"]>;
  piano: InstanceType<ToneModule["Sampler"]>;
  drums: InstanceType<ToneModule["Sampler"]>;
  lick: InstanceType<ToneModule["Sampler"]>;
}

export function createToneEngine(): AudioEngine {
  let tone: ToneModule | null = null;
  let voices: SamplerVoiceSet | null = null;
  let playing = false;
  /** Set when the samples (or Tone itself) fail, so the UI can speak up. */
  let loadError: string | null = null;

  async function ensureVoices(): Promise<ToneModule> {
    if (!tone) tone = await import("tone");
    if (!voices && tone) {
      const T = tone;
      await T.start().catch(() => undefined); // user-gesture unlock; silent fallback if denied
      // Each loader resolves only once every buffer has decoded, so playback
      // can never start half-loaded (Tone throws on an unloaded buffer).
      try {
        const [bass, piano, drums, lick] = await Promise.all([getBassSampler(), getPianoSampler(), getDrumSampler(), getLickSampler()]);
        voices = { bass, piano, drums, lick };

        // Set default volumes
        bass.volume.value = -6;
        piano.volume.value = -6;
        drums.volume.value = -8;
        lick.volume.value = -2;
        loadError = null;
      } catch (e) {
        // A sample that 404s, fails to decode, or is missing from the map.
        loadError = e instanceof Error ? e.message : "audio samples failed to load";
        throw e;
      }
    }
    if (!tone) throw new Error("tone unavailable");
    return tone;
  }

  function triggerSampler(v: SamplerVoiceSet, i: PlaybackInstruction, at: number): void {
    const sampler = v[voiceForInstrument(i.instrument)];
    // Belt and braces: never trigger a voice whose buffers are not ready.
    if (!sampler.loaded) return;
    sampler.triggerAttackRelease(i.note, i.durationSeconds, at, i.velocity);
  }

  return {
    async unlock(): Promise<void> {
      await ensureVoices();
    },
    get isPlaying(): boolean {
      // Playback is only "playing" once the transport is actually running.
      return playing && !!(tone?.getTransport().state === "started");
    },
    get lastError(): string | null {
      return loadError;
    },
    play(events: readonly TimedEvent[], totalSeconds: number): BandPlayback {
      const instructions = toPlaybackInstructions(events);
      let resolveDone!: () => void;
      const finished = new Promise<void>((r) => (resolveDone = r));
      let stopped = false;
      const cleanup = (T: ToneModule): void => {
        T.getTransport().cancel(0);
        T.getTransport().pause();
        playing = false;
      };
      // `playing` is only raised once the transport actually starts: the UI must
      // never claim playback while the samples are still loading.
      void ensureVoices()
        .then((T) => {
          if (stopped) return;
          const tr = T.getTransport();
          tr.cancel(0);
          if (!voices) return;
          const vs = voices;
          for (const i of instructions) tr.schedule((time) => !stopped && triggerSampler(vs, i, time), i.timeSeconds);
          tr.schedule(() => {
            if (!stopped) cleanup(T);
            resolveDone();
          }, totalSeconds + 0.1);
          tr.position = 0;
          void tr.start();
          playing = true;
        })
        .catch(() => {
          playing = false;
          resolveDone();
        });
      return {
        stop(): void {
          stopped = true;
          if (tone) cleanup(tone);
          playing = false;
          resolveDone();
        },
        finished,
      };
    },
  };
}

export type { Instrument } from "./schedule.js";
