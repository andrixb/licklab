// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { buildChorus, chorusSeconds, toTimedEvents, type BandPart } from "../../src/domain/band.js";
import { flattenProgression, parseProgressionInput } from "../../src/domain/progression.js";
import { toPlaybackInstructions } from "../../src/adapters/tone/schedule.js";
import { createFakeAudioEngine } from "../../src/adapters/memory/audio.js";

const part: BandPart = { bass: true, piano: true, drums: true, tempoBpm: 120 };
const flat = flattenProgression(parseProgressionInput("Dm7 | G7 | Cmaj7 |"));

describe("audio timing (pure, no listening)", () => {
  it("120bpm: 4-beat count-in = 2s offset; beat = 0.5s", () => {
    const plan = buildChorus(flat, "swing", part);
    const timed = toTimedEvents(plan, 120);
    const first = timed.reduce((m, e) => Math.min(m, e.timeSeconds), Infinity);
    expect(first).toBeCloseTo(2, 5); // count-in of 4 beats at 120bpm
    const bassByBeat = timed.filter((e) => e.voice === "bass");
    expect(bassByBeat[1]!.timeSeconds - bassByBeat[0]!.timeSeconds).toBeCloseTo(0.5, 5);
  });
  it("chorusSeconds = (totalBeats + countIn) * 60/bpm", () => {
    const plan = buildChorus(flat, "swing", part);
    expect(chorusSeconds(plan, 120)).toBeCloseTo((12 + 4) * 0.5, 5);
  });
  it("throws on bad tempo", () => {
    const plan = buildChorus(flat, "swing", part);
    expect(() => toTimedEvents(plan, 0)).toThrow();
  });
});

describe("tone scheduling mapping", () => {
  it("maps voices to instruments, drums to GM notes, preserves order", () => {
    const plan = buildChorus(flat, "swing", { bass: true, piano: false, drums: true, tempoBpm: 100 });
    const instr = toPlaybackInstructions(toTimedEvents(plan, 100));
    expect(instr.every((i) => ["bass", "kick", "snare", "hat", "ride", "rideBell", "crash"].includes(i.instrument))).toBe(true);
    expect(instr.some((i) => i.instrument === "ride")).toBe(true);
    for (const i of instr) expect(Number.isInteger(i.note)).toBe(true);
  });
  it("accents map to higher velocity", () => {
    const plan = buildChorus(flat, "swing", { bass: false, piano: false, drums: true, tempoBpm: 120 });
    const instr = toPlaybackInstructions(toTimedEvents(plan, 120));
    const accented = instr.filter((i) => i.velocity === 1);
    expect(accented.length).toBeGreaterThan(0);
  });
});

describe("FakeAudioEngine (port contract)", () => {
  it("records playbacks and satisfies AudioEngine", async () => {
    const engine = createFakeAudioEngine();
    const plan = buildChorus(flat, "bossa", part);
    const playback = engine.play(toTimedEvents(plan, 120), chorusSeconds(plan, 120));
    expect(engine.isPlaying).toBe(true);
    expect(engine.played).toHaveLength(1);
    playback.stop();
    await playback.finished;
    expect(engine.isPlaying).toBe(false);
    expect(engine.stopCount).toBe(1);
  });
});
