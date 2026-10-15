// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// Engine routing contract: every voice gets connected to the speakers, and
// every instruction reaches exactly one loaded voice with its note.
// Regression: M3.5 swapped synths for Samplers and dropped the M3 engine's
// `.toDestination()` wiring — the transport ran, notes fired, "playing" showed,
// and nothing was audible because every output was unconnected.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Scheduled {
  time: number;
  cb: (t: number) => void;
}

class MockSampler {
  static instances: MockSampler[] = [];
  readonly urls: Record<string, string>;
  readonly baseUrl: string;
  readonly triggered: { note: string | number; duration: number; time: number; velocity: number }[] = [];
  readonly loaded = true;
  readonly volume = { value: 0 };
  connected = false;
  constructor(opts: { urls: Record<string, string>; baseUrl: string; onload?: () => void }) {
    this.urls = opts.urls;
    this.baseUrl = opts.baseUrl;
    MockSampler.instances.push(this);
    // like Tone: buffers "decode" deferred, then onload fires
    void Promise.resolve().then(() => opts.onload?.());
  }
  toDestination(): this {
    this.connected = true;
    return this;
  }
  triggerAttackRelease(note: string | number, duration: number, time: number, velocity: number): void {
    this.triggered.push({ note, duration, time, velocity });
  }
  releaseAll(): void {}
  dispose(): void {}
}

const transport = {
  scheduled: [] as Scheduled[],
  state: "stopped",
  statesSeen: ["stopped"] as string[],
  loop: false,
  loopEnd: 0,
  seconds: 0,
  cancel(): void {},
  pause(): void {
    transport.state = "paused";
    transport.statesSeen.push("paused");
  },
  start(): Promise<void> {
    transport.state = "started";
    transport.statesSeen.push("started");
    for (const s of transport.scheduled) s.cb(s.time);
    return Promise.resolve();
  },
  schedule(cb: (t: number) => void, time: number): number {
    transport.scheduled.push({ time, cb });
    return transport.scheduled.length;
  },
};

vi.mock("tone", () => ({
  Sampler: MockSampler,
  start: async (): Promise<void> => undefined,
  getTransport: () => transport,
  Frequency: class {
    midi: number;
    units: string | undefined;
    constructor(midi: number, units?: string) {
      this.midi = midi;
      this.units = units;
    }
    toNote(): string {
      // Minimal MIDI->note (sharps) matching Tone's output for the test range.
      const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const m = this.midi;
      const name = names[((m % 12) + 12) % 12] as string;
      return `${name}${Math.floor(m / 12) - 1}`;
    }
  },
}));

const timed = (voice: "bass" | "drums" | "piano" | "lick", midi: number, atBeatSeconds: number) => ({
  voice,
  timeBeats: atBeatSeconds,
  durationBeats: 0.9,
  midi,
  timeSeconds: atBeatSeconds,
  durationSeconds: 0.4,
  accent: false as const,
});

describe("tone engine routing", () => {
  beforeEach(() => {
    MockSampler.instances = [];
    transport.scheduled = [];
    transport.state = "stopped";
    transport.statesSeen = ["stopped"];
    transport.loop = false;
    transport.loopEnd = 0;
    transport.seconds = 0;
    vi.resetModules();
  });

  it("connects every voice to the speakers before playback", async () => {
    const { createToneEngine } = await import("../../src/adapters/tone/engine.js");
    const engine = createToneEngine();
    const playback = engine.play([timed("bass", 40, 0.5)], 2);
    await playback.finished;
    expect(MockSampler.instances).toHaveLength(4);
    expect(MockSampler.instances.every((s) => s.connected)).toBe(true);
  });

  it("routes each instrument to its own voice with the right note and time", async () => {
    const { createToneEngine } = await import("../../src/adapters/tone/engine.js");
    const engine = createToneEngine();
    const playback = engine.play(
      [timed("bass", 40, 0.5), timed("drums", 36, 1.0), timed("piano", 60, 1.5), timed("lick", 64, 2.0)],
      4,
    );
    await playback.finished;
    const triggered = MockSampler.instances.filter((s) => s.triggered.length > 0);
    expect(triggered).toHaveLength(4);
    // MIDI numbers are converted to Tone note names (Frequency(midi).toNote):
    // raw numbers would sound ~2 octaves low (60Hz = B1, not C4).
    const landed = new Map<string | number, number[]>();
    for (const s of triggered) {
      expect(s.triggered).toHaveLength(1);
      const t = s.triggered[0]!;
      landed.set(t.note, [...(landed.get(t.note) ?? []), t.time]);
    }
    expect(landed.get("E2")).toEqual([0.5]); // 40
    expect(landed.get("C2")).toEqual([1.0]); // 36
    expect(landed.get("C4")).toEqual([1.5]); // 60
    expect(landed.get("E4")).toEqual([2.0]); // 64
  });

  it("drives the transport through a real start", async () => {
    const { createToneEngine } = await import("../../src/adapters/tone/engine.js");
    const engine = createToneEngine();
    expect(engine.isPlaying).toBe(false);
    const playback = engine.play(
      [{ voice: "drums", drum: "kick", timeBeats: 0, durationBeats: 0.25, midi: 36, timeSeconds: 0.5, durationSeconds: 0.15, accent: false }],
      1,
    );
    await playback.finished;
    // the transport really ran the chorus then cleaned up (not "playing" forever)
    expect(transport.statesSeen).toContain("started");
    expect(transport.state).toBe("paused");
    expect(engine.isPlaying).toBe(false);
  });

  it("loop mode arms the transport loop and reports position", async () => {
    const { createToneEngine } = await import("../../src/adapters/tone/engine.js");
    const engine = createToneEngine();
    const playback = engine.play([timed("bass", 40, 0.5)], 2, undefined, { loop: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(transport.loop).toBe(true);
    expect(transport.loopEnd).toBe(2);
    transport.seconds = 1.25;
    expect(engine.getPositionSeconds()).toBe(1.25);
    playback.stop();
    await playback.finished;
    expect(transport.loop).toBe(false);
    expect(engine.getPositionSeconds()).toBe(1.25);
  });

  it("mixer levels reach the triggered velocities", async () => {
    const { createToneEngine } = await import("../../src/adapters/tone/engine.js");
    MockSampler.instances = [];
    transport.scheduled = [];
    const engine = createToneEngine();
    const playback = engine.play([timed("bass", 40, 0.5)], 2, undefined, { levels: { bass: 0.5 } });
    await playback.finished;
    const hit = MockSampler.instances.flatMap((s) => s.triggered);
    expect(hit).toHaveLength(1);
    expect(hit[0]!.velocity).toBeLessThan(0.8);
  });

  it("dx7 without an FM voice falls back to the sampler silently", async () => {
    // The unit Tone mock provides no FMSynth: selecting DX7 must not drop
    // the note (production builds the FM voice beside the samplers).
    const { createToneEngine } = await import("../../src/adapters/tone/engine.js");
    MockSampler.instances = [];
    transport.scheduled = [];
    const engine = createToneEngine();
    engine.setPianoVoice("dx7");
    const playback = engine.play([timed("piano", 60, 0.5)], 2);
    await playback.finished;
    expect(MockSampler.instances.flatMap((s) => s.triggered)).toHaveLength(1);
  });
});
