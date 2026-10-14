// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { auditionLick, playChorus, playSoloChorus, playTwelveKeys } from "../../src/application/playback.js";
import { analyzeProgression } from "../../src/domain/progression.js";
import { parseProgressionInput } from "../../src/domain/progression.js";
import { validLick } from "../../src/domain/lick.test.js";
import { createFakeAudioEngine } from "../../src/adapters/memory/audio.js";
import { midiOf } from "../../src/domain/pitch.js";

const bars = parseProgressionInput("Dm7 | G7 | Cmaj7 |");
const prog = {
  id: "p",
  title: "",
  key: "C",
  bars,
  ownerId: "o",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  schemaVersion: 1,
};
const opts = { style: "swing" as const, tempoBpm: 120, parts: { bass: true, piano: false, drums: true, tempoBpm: 120 } };

const iiviLick = validLick({
  title: "ii-V-I line",
  harmonicContext: {
    chords: [
      { symbol: "Dm7", beats: 4 },
      { symbol: "G7", beats: 4 },
      { symbol: "Cmaj7", beats: 4 },
    ],
    originalKey: "C",
    function: "ii-V-I major",
  },
});

describe("playback use cases (fake engine, no audio)", () => {
  it("playChorus schedules band events starting after the count-in", async () => {
    const engine = createFakeAudioEngine();
    await playChorus(engine, bars, opts);
    const played = engine.played[0]!;
    expect(played.length).toBeGreaterThan(0);
    expect(played.every((e) => e.timeSeconds >= 2 - 1e-9)).toBe(true); // 4 beats @120 = 2s count-in
  });
  it("auditionLick places the lick at beat 0 window (count-in offset)", async () => {
    const engine = createFakeAudioEngine();
    const segments = analyzeProgression(prog);
    const playback = await auditionLick(engine, bars, segments, iiviLick, opts);
    expect(playback).not.toBeNull();
    const lickEvents = engine.played[0]!.filter((e) => e.voice === "lick");
    expect(lickEvents.length).toBeGreaterThan(0);
    expect(Math.min(...lickEvents.map((e) => e.timeSeconds))).toBeCloseTo(2, 5);
  });
  it("auditionLick returns null when the lick fits nowhere", async () => {
    const engine = createFakeAudioEngine();
    const turnaround = validLick({
      harmonicContext: {
        chords: [
          { symbol: "Cmaj7", beats: 4 },
          { symbol: "Am7", beats: 4 },
          { symbol: "Dm7", beats: 4 },
          { symbol: "G7", beats: 4 },
        ],
        originalKey: "C",
        function: "turnaround",
      },
    });
    expect(await auditionLick(engine, bars, analyzeProgression(prog), turnaround, opts)).toBeNull();
  });
  it("playSoloChorus stacks multiple placed licks", async () => {
    const engine = createFakeAudioEngine();
    const segments = analyzeProgression(prog);
    const second = validLick({
      id: "second",
      title: "static C",
      pattern: [{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 4 }],
      harmonicContext: { chords: [{ symbol: "Cmaj7", beats: 4 }], originalKey: "C", function: "static major" },
    });
    await playSoloChorus(engine, bars, segments, [{ lick: iiviLick, segmentIndex: 0 }, { lick: second, segmentIndex: 0 }], opts);
    const lickVoices = engine.played[0]!.filter((e) => e.voice === "lick");
    expect(lickVoices.length).toBeGreaterThan(3);
  });
  it("playTwelveKeys spans 12 transpositions of the context", async () => {
    const engine = createFakeAudioEngine();
    await playTwelveKeys(engine, iiviLick, opts);
    const events = engine.played[0]!;
    const roots = new Set<number>();
    for (const e of events.filter((x) => x.voice === "bass" && Math.abs(x.timeSeconds % 6) < 1e-6)) {
      if (e.pitch) roots.add(midiOf(e.pitch) % 12);
    }
    expect(roots.size).toBe(12);
    const last = events.reduce((m, e) => Math.max(m, e.timeSeconds), 0);
    expect(last).toBeGreaterThan(11 * 12 * 0.5); // 12 choruses of 12 beats at 0.5s
  });
});
