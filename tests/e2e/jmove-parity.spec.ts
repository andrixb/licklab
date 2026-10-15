// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// JMove parity (headless browser proof for ADR-023):
//  1. The real adapter running in the real browser bundle produces
//     event-for-event the same notes as the pinned @jmove/generator
//     reference (tests/e2e/fixtures/jmove-parity-ref.json — regenerate with
//     PARITY_REF=tests/e2e/fixtures/jmove-parity-ref.json npx vite-node
//     tests/e2e/fixtures/gen-parity-ref.ts after any adapter change).
//     Same chart, key, seed and settings throughout. The JMove demo
//     (jmove.it.com/app, "gen 1.5.1") runs this exact library version, so
//     the library IS the demo's generation behavior; the demo app itself
//     is closed-source with no test hooks to drive.
//  2. The audio chain renders those MIDI numbers at the right pitch: the
//     REAL app engine (Tone.Transport + Tone.Sampler + shipped samples)
//     plays probed notes while the destination is tapped and recorded;
//     peak detection must read bass Bb2, A4 = 440 Hz and a Bb7 shell
//     (3rd/5th/b7, no major 7th) within +/-30 cents.

import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

interface RefEvent {
  voice: string;
  midi?: number;
  drum?: string;
  timeBeats: number;
  durationBeats: number;
  velocity?: number;
}
interface RefRun {
  input: string;
  opts: Record<string, number>;
  events: RefEvent[];
}

const REF_PATH = new URL("./fixtures/jmove-parity-ref.json", import.meta.url);

// The two tests share one page/audio device; run them serially so the
// realtime audio take never competes with the compute-heavy parity sweep.
test.describe.configure({ mode: "serial" });

function loadRef(): Record<string, RefRun> {
  return JSON.parse(readFileSync(REF_PATH, "utf8")) as Record<string, RefRun>;
}

test("browser adapter output matches the JMove reference event-for-event", async ({ page }) => {
  const ref = loadRef();
  await page.goto("/play?c=Dm7%20G7%20%7C%20Cmaj7%20%7C");
  await expect(page.getByRole("region", { name: "progression workspace" })).toBeVisible();

  for (const [key, run] of Object.entries(ref)) {
    const inPage = (await page.evaluate(
      async (job: { input: string; opts: Record<string, number>; prog: string; gen: string }) => {
        const progMod = (await import(/* @vite-ignore */ job.prog)) as {
          flattenProgression: (b: unknown) => { symbol: string; beats: number; startBeat: number }[];
          parseProgressionInput: (s: string) => unknown;
        };
        const genMod = (await import(/* @vite-ignore */ job.gen)) as {
          createJmoveBandProvider: () => {
            generateBand: (
              flat: unknown, style: string, part: unknown, tempo: number, opts: unknown,
            ) => Promise<
              { voice: string; midi?: number; drum?: string; timeBeats: number; durationBeats: number; velocity?: number }[]
            >;
          };
        };
        const flat = progMod.flattenProgression(progMod.parseProgressionInput(job.input));
        const provider = genMod.createJmoveBandProvider();
        const events = await provider.generateBand(
          flat, "swing", { bass: true, piano: true, drums: true, tempoBpm: 120 }, 120, job.opts,
        );
        return events.map((e) => ({
          voice: e.voice, midi: e.midi ?? null, drum: e.drum ?? null,
          t: Math.round(e.timeBeats * 1e6) / 1e6,
          d: Math.round(e.durationBeats * 1e6) / 1e6,
          v: Math.round((e.velocity ?? -1) * 1e6) / 1e6,
        }));
      },
      {
        input: run.input, opts: run.opts,
        prog: "/src/domain/progression.ts", gen: "/src/adapters/jmove/generator.ts",
      },
    )) as { voice: string; midi: number | null; drum: string | null; t: number; d: number; v: number }[];

    const expected = run.events.map((e) => ({
      voice: e.voice, midi: e.midi ?? null, drum: e.drum ?? null,
      t: Math.round(e.timeBeats * 1e6) / 1e6,
      d: Math.round(e.durationBeats * 1e6) / 1e6,
      v: Math.round((e.velocity ?? -1) * 1e6) / 1e6,
    }));
    expect(inPage, `${key}: event count`).toHaveLength(expected.length);
    expect(inPage, `${key}: events`).toEqual(expected);
  }
});

interface AudioReport {
  log: { voice: string; note: string; at: number }[];
  bass: { midi: number; cents: number; onset: number };
  a4: { midi: number; cents: number; onset: number };
  hz440: number;
  chroma: number[];
}

test.describe("rendered audio (realtime take)", () => {
  // Realtime capture in headless Chromium is at the mercy of CPU
  // contention from parallel workers (dropouts corrupt a take at random).
  // The deterministic guards (trigger log in this test, unit tests, the
  // event-for-event test above) catch real regressions every run; retries
  // here only absorb headless scheduling noise.
  test.describe.configure({ retries: 2 });

  test("rendered audio sounds the emitted MIDI numbers (Bb2, A4=440, Bb7 shell)", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/play?c=Bb7%20%7C");
  await expect(page.getByRole("region", { name: "progression workspace" })).toBeVisible();
  // Real user gesture so the AudioContext is allowed to run headless.
  await page.getByRole("button", { name: "Blues in F (12 bar)" }).click();

  const report = (await page.evaluate(async (engPath: string) => {
    const engMod = (await import(/* @vite-ignore */ engPath)) as {
      createToneEngine: () => {
        unlock: () => Promise<void>;
        play: (
          events: { voice: string; timeBeats: number; durationBeats: number; midi: number; timeSeconds: number; durationSeconds: number }[],
          totalSeconds: number,
        ) => { stop: () => void; finished: Promise<void> };
      };
    };
    const engine = engMod.createToneEngine();
    await engine.unlock();
    const hook = (globalThis as unknown as {
      __licklabAudio?: {
        tone?: {
          getDestination: () => { connect: (n: AudioNode) => void };
          getContext: () => { rawContext: AudioContext };
        };
        voices?: Record<string, { triggerAttackRelease: (...a: unknown[]) => void }>;
      };
    }).__licklabAudio;
    if (!hook?.tone || !hook.voices) throw new Error("DEV audio hook missing (needs vite dev)");
    const log: { voice: string; note: string; at: number }[] = [];
    for (const [voice, sampler] of Object.entries(hook.voices)) {
      const orig = sampler.triggerAttackRelease.bind(sampler);
      sampler.triggerAttackRelease = ((note: unknown, dur: unknown, at: unknown, vel: unknown) => {
        log.push({ voice, note: String(note), at: Number(at) });
        return (orig as (...a: unknown[]) => void)(note, dur, at, vel);
      }) as (...a: unknown[]) => void;
    }
    const raw = hook.tone.getContext().rawContext;
    const tap = raw.createMediaStreamDestination();
    hook.tone.getDestination().connect(tap);

    const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
    // Goertzel energy at one frequency; data/sr bound per take.
    const makeGoertzel = (data: Float32Array, sr: number) => (off: number, len: number, freq: number): number => {
      const w = (2 * Math.PI * freq) / sr;
      const cos = Math.cos(w);
      let s0 = 0, s1 = 0, s2 = 0;
      const end = Math.min(off + len, data.length);
      for (let i = off; i < end; i++) { s0 = (data[i] ?? 0) + 2 * cos * s1 - s2; s2 = s1; s1 = s0; }
      return s1 * s1 + s2 * s2 - s1 * s2 * cos;
    };

    // One short take per probe: short takes survive headless recorder
    // truncation, and onset anchoring survives start latency. Each take
    // plays from a clean transport.
    const take = async (
      events: { voice: string; midi: number; at: number }[],
      totalSeconds: number,
    ): Promise<{ data: Float32Array; sr: number }> => {
      const rec = new MediaRecorder(tap.stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e: BlobEvent): void => { if (e.data.size > 0) chunks.push(e.data); };
      const stopped = new Promise<void>((resolve) => { rec.onstop = (): void => resolve(); });
      rec.start();
      const playback = engine.play(
        events.map((e) => ({
          voice: e.voice, timeBeats: e.at, durationBeats: 1, midi: e.midi, timeSeconds: e.at, durationSeconds: 1.4,
        })),
        totalSeconds,
      );
      await playback.finished;
      rec.stop();
      await stopped;
      const decoded = await raw.decodeAudioData(await new Blob(chunks).arrayBuffer());
      return { data: decoded.getChannelData(0), sr: decoded.sampleRate };
    };

    const takes = {
      bass: await take([{ voice: "bass", midi: 46, at: 0.4 }], 2.2),
      a4: await take([{ voice: "piano", midi: 69, at: 0.4 }], 2.2),
      shell: await take(
        [
          { voice: "piano", midi: 62, at: 0.3 },
          { voice: "piano", midi: 65, at: 0.4 },
          { voice: "piano", midi: 68, at: 0.5 },
        ],
        2.4,
      ),
    };

    // Onset-anchored analysis (shift-invariant): find when the target pitch
    // first dominates, then analyze the ring that follows.
    const analyze = (
      takeData: { data: Float32Array; sr: number },
      target: number, lo: number, hi: number,
    ): { midi: number; cents: number; onset: number } => {
      const { data, sr } = takeData;
      const goertzel = makeGoertzel(data, sr);
      const step = 0.1;
      const win = 0.3;
      let peakT = 0, peakE = -1;
      const energies: { t: number; e: number }[] = [];
      for (let t = 0; t + win <= data.length / sr; t += step) {
        const e = goertzel(Math.floor(t * sr), Math.floor(win * sr), midiHz(target));
        energies.push({ t, e });
        if (e > peakE) { peakE = e; peakT = t; }
      }
      if (peakE <= 0) throw new Error(`silence in take (target ${target})`);
      const thresh = peakE * 0.2;
      let onset = peakT;
      for (const { t, e } of energies) {
        if (t > peakT - 2.5 && e >= thresh) { onset = t; break; }
      }
      // Majority vote over sub-windows of the ring that follows.
      const from = onset + 0.15;
      const stop = onset + 1.1;
      const span = 0.24;
      const votes = new Map<number, number>();
      for (let w = from; w + span <= Math.min(stop, data.length / sr) + 1e-9; w += span) {
        const off = Math.floor(w * sr);
        const len = Math.floor(span * sr);
        let best = lo, bestE = -1;
        for (let m = lo; m <= hi; m++) {
          const e = goertzel(off, len, midiHz(m));
          if (e > bestE) { bestE = e; best = m; }
        }
        votes.set(best, (votes.get(best) ?? 0) + 1);
      }
      let midi = lo, count = -1;
      for (const [m, c] of votes) {
        if (c > count) { count = c; midi = m; }
      }
      // Cents on the sustain (past the attack click, which is broadband
      // and flattens the parabolic fit, especially for pizz bass).
      const coff = Math.floor((from + 0.2) * sr);
      const clen = Math.max(0, Math.floor(Math.min(stop, data.length / sr) * sr) - coff);
      const e1 = goertzel(coff, clen, midiHz(midi));
      const e0 = goertzel(coff, clen, midiHz(midi) * 2 ** (-1 / 12));
      const e2 = goertzel(coff, clen, midiHz(midi) * 2 ** (1 / 12));
      const denom = e0 - 2 * e1 + e2;
      const shift = denom !== 0 ? (e0 - e2) / (2 * denom) : 0;
      return { midi, cents: Math.max(-50, Math.min(50, shift * 100)), onset };
    };

    const bass = analyze(takes.bass, 46, 33, 57);
    const a4 = analyze(takes.a4, 69, 60, 80);
    // Shell chroma over the anchored ring (all three notes overlap there).
    // Up to 3 attempts: headless capture can drop out under CPU contention
    // (the parallel worker), which attenuates a note's ring at random. A
    // genuinely broken chain (wrong sample, wrong pitch) fails every
    // attempt deterministically, so retries cannot mask a real bug.
    let chroma: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const shellTake =
        attempt === 0
          ? takes.shell
          : await take(
              [
                { voice: "piano", midi: 62, at: 0.3 },
                { voice: "piano", midi: 65, at: 0.4 },
                { voice: "piano", midi: 68, at: 0.5 },
              ],
              2.4,
            );
      const shellProbe = analyze(shellTake, 68, 60, 80);
      const { data: sData, sr: sSr } = shellTake;
      const sGoertzel = makeGoertzel(sData, sSr);
      const next: number[] = [];
      const sOff = Math.floor((shellProbe.onset + 0.2) * sSr);
      const sLen = Math.floor(1.0 * sSr);
      // Octaves 2-4 only: the fundamentals live here, while D4's 3rd
      // harmonic (A5 = pc 9) is excluded — otherwise piano timbre alone
      // trips the "no major 7th" check. A real maj7 threat (A3/A4) still
      // lands in range.
      for (let p = 0; p < 12; p++) {
        let e = 0;
        for (let oct = 2; oct <= 4; oct++) {
          const midi = p + oct * 12;
          if (midi >= 21 && midi <= 108) e += sGoertzel(sOff, sLen, midiHz(midi));
        }
        next.push(e);
      }
      const max = Math.max(...next);
      chroma = next.map((e) => Math.round((e / max) * 1000) / 1000);
      if ([2, 5, 8].every((p) => (chroma[p] ?? 0) > 0.3) && (chroma[9] ?? 1) < 0.35) break;
    }
    return {
      log,
      bass, a4,
      hz440: 440 * 2 ** ((a4.midi - 69 + a4.cents / 100) / 12),
      chroma,
    };
  }, "/src/adapters/tone/engine.ts")) as AudioReport;

  // The engine logged every triggered note with the sampler note name
  // (three short takes: bass, A4, then the shell; a chroma retry replays
  // the shell take, so extra shell triggers may follow).
  const logged = report.log.map((l) => [l.voice, l.note]);
  expect(logged.slice(0, 5)).toEqual([
    ["bass", "A#2"], // MIDI 46 = Bb2 (enharmonic; Tone matches samples by MIDI)
    ["piano", "A4"],
    ["piano", "D4"],
    ["piano", "F4"],
    ["piano", "G#4"], // MIDI 68 = Ab4 (b7 of Bb)
  ]);
  for (const [voice, note] of logged.slice(5)) {
    expect(voice).toBe("piano");
    expect(["D4", "F4", "G#4"]).toContain(note);
  }
  // Bass Bb2 renders as MIDI 46 within +/-30 cents.
  expect(report.bass.midi).toBe(46);
  expect(Math.abs(report.bass.cents)).toBeLessThan(30);
  // A4 renders at 440 Hz within +/-30 cents.
  expect(report.a4.midi).toBe(69);
  expect(Math.abs(report.a4.cents)).toBeLessThan(30);
  expect(Math.abs(report.hz440 - 440) / 440).toBeLessThan(0.02);
  // Bb7 shell: D(2), F(5), Ab(8) present; A-natural pc 9 (major 7th) quiet.
  for (const p of [2, 5, 8]) expect(report.chroma[p]).toBeGreaterThan(0.3);
  expect(report.chroma[9]).toBeLessThan(0.35);
  });
});
