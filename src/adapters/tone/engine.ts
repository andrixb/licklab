// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone: AudioEngine via Tone.js Transport (never setTimeout for
// audio). The ~200KB tone module loads lazily on first play to stay out of the
// initial payload (budget check). Sample-based voices (CC0/CC-BY) load on first
// play; Tone.Transport schedules all events. Nothing is triggered before its
// sampler's buffers have decoded (guaranteed by the `ready` promises in
// ./samplers — `Sampler.loaded` is only a boolean, never an awaitable).

import type { AudioEngine, BandLevels, BandPlayback, BandPlayOpts, PianoVoice, BassVariant, PianoVariant, DrumVariant } from "../../application/ports.js";
import type { TimedEvent } from "../../domain/band.js";
import { toPlaybackInstructions, voiceForInstrument, type PlaybackInstruction } from "./schedule.js";
import { getBassSampler, getDrumSampler, getLickSampler, getPianoSampler } from "./samplers.js";

type ToneModule = typeof import("tone");

/** MIDI number -> Tone note name (sharps), e.g. 60 -> "C4", 46 -> "A#1"/"Bb1".
 *  Pure so pitch mapping is unit-testable without Web Audio. */
export function midiToNote(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
  const m = Math.round(midi);
  const name = names[((m % 12) + 12) % 12] as string;
  return `${name}${Math.floor(m / 12) - 1}`;
}

interface SamplerVoiceSet {
  bass: InstanceType<ToneModule["Sampler"]>;
  piano: InstanceType<ToneModule["Sampler"]>;
  drums: InstanceType<ToneModule["Sampler"]>;
  lick: InstanceType<ToneModule["Sampler"]>;
}

export function createToneEngine(): AudioEngine {
  const state = {
    tone: null as ToneModule | null,
    voices: null as SamplerVoiceSet | null,
    fmPiano: null as InstanceType<ToneModule["FMSynth"]> | null,
    pianoVoice: "upright" as PianoVoice,
    bassVariant: "upright" as BassVariant,
    pianoVariant: "upright" as PianoVariant,
    drumVariant: "jazz" as DrumVariant,
    playing: false,
    loadError: null as string | null,
    instanceId: Math.random().toString(36).substring(7),
    levels: { bass: 1, piano: 1, drums: 1, lick: 1 } as BandLevels,
  };

  console.log('[Engine] Created instance:', state.instanceId);

  async function ensureVoices(): Promise<ToneModule> {
    if (!state.tone) state.tone = await import("tone");
    if (!state.voices && state.tone) {
      const T = state.tone;
      await T.start().catch(() => undefined);
      console.log('[Engine] ensureVoices START - bassVariant:', state.bassVariant, 'pianoVariant:', state.pianoVariant, 'drumVariant:', state.drumVariant, 'instanceId:', state.instanceId);
      try {
        const [bass, piano, drums, lick] = await Promise.all([
          getBassSampler(state.bassVariant),
          getPianoSampler(state.pianoVariant),
          getDrumSampler(state.drumVariant),
          getLickSampler(state.pianoVariant)
        ]);
        state.voices = { bass, piano, drums, lick };

        applyVolumes();
        // Direct wiring (like the demo's per-part Gains): no compressor /
        // full-wet reverb wash. The previous bus (Compressor + Reverb wet=1
        // + Limiter) dulled transients and is bypassed by variant reloads
        // anyway (they call toDestination directly), so all takes now share
        // one bright path.
        state.voices.bass.toDestination();
        state.voices.piano.toDestination();
        state.voices.drums.toDestination();
        state.voices.lick.toDestination();
        state.loadError = null;
        if (import.meta.env.DEV) {
          (globalThis as unknown as { __licklabAudio?: unknown }).__licklabAudio = { tone: state.tone, voices: state.voices };
        }
      } catch (e) {
        state.loadError = e instanceof Error ? e.message : "audio samples failed to load";
        throw e;
      }
    }
    if (!state.tone) throw new Error("tone unavailable");
    return state.tone;
  }

  function triggerSampler(v: SamplerVoiceSet, i: PlaybackInstruction, at: number): void {
    const sampler = v[voiceForInstrument(i.instrument)];
    if (!sampler.loaded) return;
    // Tone.Frequency(number) treats the number as Hz, NOT MIDI (60 -> 60Hz
    // -> B1). Convert MIDI explicitly so Bb1 (46) sounds Bb1, not F#1.
    // This matches the demo, which converts via midiToToneName for synths
    // and passes MIDI only to its own sample-instrument API. Pure conversion
    // (no Tone dependency) so it is unit-testable without Web Audio.
    const note = midiToNote(i.note);
    try {
      sampler.triggerAttackRelease(note, i.durationSeconds, at, i.velocity);
    } catch {
      // A swap mid-take disposes the old sampler; a note landing in the gap
      // must never surface as a page error (demo's silenceAll is equally
      // defensive). The next notes use the fresh sampler.
    }
  }

  function applyVolumes(): void {
    if (!state.voices) return;
    const dbOf = (level: number | undefined): number => {
      const l = level ?? 1;
      if (l <= 0) return -60;
      return 20 * Math.log10(Math.min(1.5, Math.max(0.01, l)));
    };
    // Base balances (demo-like: bass forward, piano under, drums present)
    // plus the live mixer offset so volume sliders move audibly mid-take.
    state.voices.bass.volume.value = -8 + dbOf(state.levels.bass);
    state.voices.piano.volume.value = -7 + dbOf(state.levels.piano);
    state.voices.drums.volume.value = -10 + dbOf(state.levels.drums);
    state.voices.lick.volume.value = -3 + dbOf(state.levels.lick);
  }

  return {
    async unlock(): Promise<void> {
      await ensureVoices();
    },
    async setBassVariant(variant: BassVariant): Promise<void> {
      console.log('[Engine] setBassVariant:', variant);
      if (variant === state.bassVariant) return;
      state.bassVariant = variant;
      if (state.voices) {
        // Load first, swap second: no gap where a scheduled note hits a
        // disposed sampler ("No available buffers") mid-take.
        const next = await getBassSampler(variant);
        state.voices.bass.dispose();
        state.voices.bass = next;
        state.voices.bass.toDestination();
        applyVolumes();
      }
    },
    async setPianoVariant(variant: PianoVariant): Promise<void> {
      console.log('[Engine] setPianoVariant:', variant);
      if (variant === state.pianoVariant) return;
      state.pianoVariant = variant;
      if (state.voices) {
        const nextPiano = await getPianoSampler(variant);
        const nextLick = await getLickSampler(variant);
        state.voices.piano.dispose();
        state.voices.piano = nextPiano;
        state.voices.piano.toDestination();
        state.voices.lick.dispose();
        state.voices.lick = nextLick;
        state.voices.lick.toDestination();
        applyVolumes();
      }
    },
    async setDrumVariant(variant: DrumVariant): Promise<void> {
      console.log('[Engine] setDrumVariant:', variant);
      if (variant === state.drumVariant) return;
      state.drumVariant = variant;
      if (state.voices) {
        const next = await getDrumSampler(variant);
        state.voices.drums.dispose();
        state.voices.drums = next;
        state.voices.drums.toDestination();
        applyVolumes();
      }
    },
    setLevels(levels: BandLevels): void {
      state.levels = { ...state.levels, ...levels };
      applyVolumes();
    },
    setPianoVoice(voice: PianoVoice): void {
      state.pianoVoice = voice;
    },
    get isPlaying(): boolean {
      return state.playing && state.tone?.getTransport().state === "started";
    },
    get lastError(): string | null {
      return state.loadError;
    },
    getPositionSeconds(): number {
      try {
        return state.tone?.getTransport().seconds ?? 0;
      } catch {
        return 0;
      }
    },
    play(events: readonly TimedEvent[], totalSeconds: number, gainDb?: number, opts?: BandPlayOpts): BandPlayback {
      void gainDb;
      if (opts?.levels) {
        state.levels = { ...state.levels, ...opts.levels };
        applyVolumes();
      }
      const instructions = toPlaybackInstructions(events, opts?.levels);
      let resolveDone!: () => void;
      const finished = new Promise<void>((r) => (resolveDone = r));
      let settled = false;
      const done = (): void => {
        if (!settled) {
          settled = true;
          resolveDone();
        }
      };
      // Per-playback flag (never a shared state field): pressing Play twice
      // stops the previous playback without silencing the new one, and Stop
      // silences everything with no hanging notes or leaked timers.
      let stopped = false;
      const cleanup = (T: ToneModule): void => {
        try {
          T.getTransport().cancel(0);
        } catch {
          /* non-Tone runtimes (unit mock) */
        }
        try {
          T.getTransport().loop = false;
        } catch {
          /* non-Tone runtimes (unit mock) */
        }
        try {
          T.getTransport().pause();
        } catch {
          /* non-Tone runtimes (unit mock) */
        }
        try {
          state.voices?.bass.releaseAll();
          state.voices?.piano.releaseAll();
          state.voices?.drums.releaseAll();
          state.voices?.lick.releaseAll();
        } catch {
          /* samplers without releaseAll; transport cancel already silences */
        }
        state.playing = false;
      };
      void ensureVoices()
        .then((T) => {
          if (stopped) {
            done();
            return;
          }
          const tr = T.getTransport();
          // Starting from a user gesture: resume the context (autoplay
          // policy) before scheduling, then start the transport once.
          tr.cancel(0);
          tr.loop = false;
          if (!state.voices) {
            state.playing = false;
            done();
            return;
          }
          // Look up voices at trigger time (not a captured snapshot) so an
          // instrument swap while playing alters the remaining notes live,
          // like the demo's setSampleInstruments.
          for (const i of instructions) {
            tr.schedule((time) => {
              if (stopped || !state.voices) return;
              triggerSampler(state.voices, i, time);
            }, i.timeSeconds);
          }
          if (opts?.loop) {
            tr.loop = true;
            tr.loopEnd = totalSeconds;
          } else {
            tr.loop = false;
            tr.schedule(() => {
              if (!stopped) cleanup(T);
              done();
            }, totalSeconds + 0.1);
          }
          tr.position = 0;
          void tr.start();
          state.playing = true;
        })
        .catch(() => {
          state.playing = false;
          done();
        });
      return {
        stop(): void {
          stopped = true;
          if (state.tone) cleanup(state.tone);
          else state.playing = false;
          done();
        },
        finished,
      } as const;
    },
  };
}
