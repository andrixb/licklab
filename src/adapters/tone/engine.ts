// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/tone: AudioEngine via Tone.js Transport (never setTimeout for
// audio). The ~200KB tone module loads lazily on first play to stay out of
// the initial payload (budget check). Synth voices for now; CC0 sample
// packs (VSCO bass / Virtuosity drums / Salamander piano) replace these
// voices behind this same port in M3.5.

import type { AudioEngine, BandPlayback } from "../../application/ports.js";
import type { TimedEvent } from "../../domain/band.js";
import { toPlaybackInstructions, type Instrument, type PlaybackInstruction } from "./schedule.js";

type ToneModule = typeof import("tone");

interface VoiceSet {
  bass: InstanceType<ToneModule["FMSynth"]>;
  piano: InstanceType<ToneModule["Synth"]>;
  lick: InstanceType<ToneModule["Synth"]>;
  kick: InstanceType<ToneModule["MembraneSynth"]>;
  snare: InstanceType<ToneModule["NoiseSynth"]>;
  hat: InstanceType<ToneModule["MetalSynth"]>;
  ride: InstanceType<ToneModule["MetalSynth"]>;
  rideBell: InstanceType<ToneModule["MetalSynth"]>;
  crash: InstanceType<ToneModule["MetalSynth"]>;
}

export function createToneEngine(): AudioEngine {
  let tone: ToneModule | null = null;
  let voices: VoiceSet | null = null;
  let playing = false;

  async function ensureVoices(): Promise<ToneModule> {
    if (!tone) tone = await import("tone");
    if (!voices && tone) {
      const T = tone;
      await T.start().catch(() => undefined); // user-gesture unlock; silent fallback if denied
      voices = {
        bass: new T.FMSynth({ harmonicity: 0.5, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.2 } }).toDestination(),
        piano: new T.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.4 } }).toDestination(),
        lick: new T.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.2 } }).toDestination(),
        kick: new T.MembraneSynth({ pitchDecay: 0.02 }).toDestination(),
        snare: new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).toDestination(),
        hat: new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
        ride: new T.MetalSynth({ envelope: { attack: 0.002, decay: 0.6, release: 0.2 }, harmonicity: 4.5, modulationIndex: 28, resonance: 4200, octaves: 1.2 }).toDestination(),
        rideBell: new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.5, release: 0.1 }, harmonicity: 4.1, modulationIndex: 24, resonance: 5000, octaves: 1 }).toDestination(),
        crash: new T.MetalSynth({ envelope: { attack: 0.001, decay: 1.2, release: 0.4 }, harmonicity: 5, modulationIndex: 34, resonance: 4400, octaves: 2 }).toDestination(),
      };
      for (const v of Object.values(voices)) {
        if ("volume" in v) (v as { volume: { value: number } }).volume.value = -8;
      }
      (voices.lick as { volume: { value: number } }).volume.value = -2;
    }
    if (!tone) throw new Error("tone unavailable");
    return tone;
  }

  function trigger(T: ToneModule, v: VoiceSet, i: PlaybackInstruction, at: number): void {
    const sec = i.durationSeconds;
    switch (i.instrument) {
      case "bass":
        v.bass.triggerAttackRelease(i.note, sec, at, i.velocity);
        break;
      case "piano":
        v.piano.triggerAttackRelease(i.note, Math.min(sec, 0.6), at, i.velocity);
        break;
      case "lick":
        v.lick.triggerAttackRelease(i.note, sec, at, i.velocity);
        break;
      case "kick":
        v.kick.triggerAttackRelease("C1", 0.25, at, i.velocity);
        break;
      case "snare":
        v.snare.triggerAttackRelease(0.12, at, i.velocity);
        break;
      case "hat":
        v.hat.triggerAttackRelease(0.08, at, i.velocity);
        break;
      case "ride":
        v.ride.triggerAttackRelease(0.35, at, i.velocity * 0.8);
        break;
      case "rideBell":
        v.rideBell.triggerAttackRelease(0.3, at, i.velocity);
        break;
      case "crash":
        v.crash.triggerAttackRelease(1.2, at, i.velocity);
        break;
      default: {
        const _ex: never = i.instrument as never;
        void _ex;
        void T;
      }
    }
  }

  return {
    async unlock(): Promise<void> {
      await ensureVoices();
    },
    get isPlaying(): boolean {
      return playing;
    },
    play(events: readonly TimedEvent[], totalSeconds: number): BandPlayback {
      const instructions = toPlaybackInstructions(events);
      let resolveDone!: () => void;
      const finished = new Promise<void>((r) => (resolveDone = r));
      playing = true;
      let stopped = false;
      const cleanup = (T: ToneModule): void => {
        T.getTransport().cancel(0);
        T.getTransport().pause();
        playing = false;
      };
      void ensureVoices()
        .then((T) => {
          const tr = T.getTransport();
          tr.cancel(0);
          const vs = voices;
          if (!vs) return;
          for (const i of instructions) tr.schedule((time) => !stopped && trigger(T, vs, i, time), i.timeSeconds);
          tr.schedule(() => {
            if (!stopped) cleanup(T);
            resolveDone();
          }, totalSeconds + 0.1);
          tr.position = 0;
          void tr.start();
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

export type { Instrument };
