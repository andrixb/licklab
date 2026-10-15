// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/memory/audio: silent AudioEngine fake (port contract tests, e2e
// and environments without Web Audio). Records playback instead of sounding.

import type { AudioEngine, BandLevels, BandPlayback, PianoVoice, BassVariant, PianoVariant, DrumVariant } from "../../application/ports.js";
import type { TimedEvent } from "../../domain/band.js";

export interface FakeAudioEngine extends AudioEngine {
  readonly played: TimedEvent[][];
  readonly stopCount: number;
  readonly pianoVoice: PianoVoice;
  readonly bassVariant: BassVariant;
  readonly pianoVariant: PianoVariant;
  readonly drumVariant: DrumVariant;
}

export function createFakeAudioEngine(): FakeAudioEngine {
  const engine = {
    played: [] as TimedEvent[][],
    stopCount: 0,
    playing: false,
    pianoVoice: "upright" as PianoVoice,
    bassVariant: "upright" as BassVariant,
    pianoVariant: "upright" as PianoVariant,
    drumVariant: "jazz" as DrumVariant,
    /** Tests can arrange a load failure to check the UI speaks up. */
    lastError: null as string | null,
    async unlock(): Promise<void> {},
    get isPlaying(): boolean {
      return engine.playing;
    },
    setPianoVoice(voice: PianoVoice): void {
      engine.pianoVoice = voice;
    },
    async setBassVariant(variant: BassVariant): Promise<void> {
      engine.bassVariant = variant;
    },
    async setPianoVariant(variant: PianoVariant): Promise<void> {
      engine.pianoVariant = variant;
    },
    async setDrumVariant(variant: DrumVariant): Promise<void> {
      engine.drumVariant = variant;
    },
    setLevels(levels: BandLevels): void {
      void levels;
    },
    getPositionSeconds(): number {
      return 0;
    },
    play(events: readonly TimedEvent[], totalSeconds: number): BandPlayback {
      if (engine.lastError) throw new Error(engine.lastError);
      engine.played.push([...events]);
      engine.playing = true;
      let resolveDone!: () => void;
      const finished = new Promise<void>((r) => (resolveDone = r));
      // "Playback" ends immediately in tests; totalSeconds recorded via played.
      void totalSeconds;
      return {
        stop(): void {
          engine.stopCount += 1;
          engine.playing = false;
          resolveDone();
        },
        finished,
      };
    },
  };
  return engine;
}
