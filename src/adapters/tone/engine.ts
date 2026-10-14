// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone: AudioEngine via Tone.js Transport (never setTimeout for
// audio). The ~200KB tone module loads lazily on first play to stay out of the
// initial payload (budget check). Sample-based voices (CC0/CC-BY) load on first
// play; Tone.Transport schedules all events. Nothing is triggered before its
// sampler's buffers have decoded (guaranteed by the `ready` promises in
// ./samplers — `Sampler.loaded` is only a boolean, never an awaitable).

import type { AudioEngine, BandPlayback, BandPlayOpts } from "../../application/ports.js";
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

        // Jazz mix for a practice tool: the harmony must read clearly (piano
        // level with the bass — you try licks over these changes), ride
        // present but not harsh. Velocities (schedule.ts) do per-hit work;
        // these are static voice balances.
        bass.volume.value = -8;
        piano.volume.value = -7;
        drums.volume.value = -10;
        lick.volume.value = -3;

        // Room + glue, built from Tone's own effects (no new deps, still lazy).
        // Small per-voice sends into a shared room (bass nearly dry, drums
        // wettest) + master compressor + safety limiter so hot choruses
        // (crash + fill + comping) never flat-top. Mocked Tone in unit tests
        // only provides Sampler/start/Transport, so every step is guarded —
        // production gets the bus, tests keep the direct wiring.
        try {
          interface FxNode {
            connect(n: unknown): unknown;
            toDestination(): unknown;
          }
          interface VerbNode extends FxNode {
            wet: { value: number };
          }
          interface GainNode extends FxNode {
            gain: { value: number };
          }
          interface ToneFx {
            Compressor?: new (opts: unknown) => FxNode;
            Freeverb?: new (opts: unknown) => VerbNode;
            Limiter?: new (ceiling: number) => FxNode;
            Gain?: new (gain: number) => GainNode;
          }
          const TAny = T as unknown as ToneFx;
          const Comp = TAny.Compressor;
          const Verb = TAny.Freeverb;
          const Lim = TAny.Limiter;
          const Gain = TAny.Gain;
          const samplers = [bass, piano, drums, lick] as unknown as FxNode[];
          const canBus =
            typeof Comp === "function" &&
            typeof Verb === "function" &&
            typeof Lim === "function" &&
            typeof Gain === "function" &&
            samplers.every((s) => typeof s.connect === "function");
          if (canBus) {
            const master = new Comp({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 });
            const limiter = new Lim(-1.5);
            const verb = new Verb({ roomSize: 0.45, dampening: 3200 });
            if (verb.wet) verb.wet.value = 1;
            // Voice -> master (dry) + voice -> send -> room -> master.
            const sends = [0.08, 0.16, 0.18, 0.14]; // bass, piano, drums, lick
            for (let i = 0; i < samplers.length; i++) {
              const s = samplers[i] as FxNode;
              const send = new Gain(sends[i] ?? 0.15);
              s.connect(master);
              s.connect(send);
              send.connect(verb);
            }
            (verb as unknown as FxNode).connect(master);
            master.connect(limiter);
            limiter.toDestination();
          } else {
            throw new Error("fx bus unavailable, direct wiring");
          }
        } catch {
          // Direct wiring fallback (unit-test mock + any effect failure).
          // A Sampler is silent until connected, so this must never be skipped.
          bass.toDestination();
          piano.toDestination();
          drums.toDestination();
          lick.toDestination();
        }
        loadError = null;
        // Diagnostics only: expose the live graph in dev so audio probes (and
        // the Playwright e2e harness) can tap Tone's destination with an
        // AnalyserNode. Stripped from production builds by the DEV gate.
        if (import.meta.env.DEV) {
          (globalThis as unknown as { __licklabAudio?: unknown }).__licklabAudio = { tone: T, voices };
        }
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
    getPositionSeconds(): number {
      try {
        return tone?.getTransport().seconds ?? 0;
      } catch {
        return 0;
      }
    },
    play(events: readonly TimedEvent[], totalSeconds: number, gainDb?: number, opts?: BandPlayOpts): BandPlayback {
      void gainDb;
      const instructions = toPlaybackInstructions(events, opts?.levels);
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
          if (opts?.loop) {
            // Seamless chorus loop: no end-cleanup; stop() ends it.
            tr.loop = true;
            tr.loopEnd = totalSeconds;
          } else {
            tr.loop = false;
            tr.schedule(() => {
              if (!stopped) cleanup(T);
              resolveDone();
            }, totalSeconds + 0.1);
          }
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
          if (tone) {
            try {
              tone.getTransport().loop = false;
            } catch {
              /* non-Tone runtimes (unit mock) */
            }
            cleanup(tone);
          }
          playing = false;
          resolveDone();
        },
        finished,
      };
    },
  };
}

export type { Instrument } from "./schedule.js";
