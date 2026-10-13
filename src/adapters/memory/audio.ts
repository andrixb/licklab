// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/memory/audio: silent AudioEngine fake (port contract tests, e2e
// and environments without Web Audio). Records playback instead of sounding.

import type { AudioEngine, BandPlayback } from "../../application/ports.js";
import type { TimedEvent } from "../../domain/band.js";

export interface FakeAudioEngine extends AudioEngine {
  readonly played: TimedEvent[][];
  readonly stopCount: number;
}

export function createFakeAudioEngine(): FakeAudioEngine {
  const engine = {
    played: [] as TimedEvent[][],
    stopCount: 0,
    playing: false,
    async unlock(): Promise<void> {},
    get isPlaying(): boolean {
      return engine.playing;
    },
    play(events: readonly TimedEvent[], totalSeconds: number): BandPlayback {
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
