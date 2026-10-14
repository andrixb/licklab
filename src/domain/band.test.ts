// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { BAND_STYLES, buildChorus, chordAtBeat, compingVoicings, drumGrid, placeLickOnBeat, walkingLine, type BandPart } from "./band.js";
import { flattenProgression, parseProgressionInput, PRESETS } from "./progression.js";
import { parseChordSymbol } from "./chords.js";
import { pitchClassOf, midiOf } from "./pitch.js";

const partAll: BandPart = { bass: true, piano: true, drums: true, tempoBpm: 120 };
const flatOf = (input: string) => flattenProgression(parseProgressionInput(input));

describe("band.walkingLine", () => {
  it("one note per beat, root on every chord downbeat", () => {
    const flat = flatOf("Dm7 | G7 | Cmaj7 |");
    const line = walkingLine(flat);
    expect(line).toHaveLength(12);
    const byBeat = new Map(line.map((e) => [e.timeBeats, e]));
    for (const c of flat) {
      const note = byBeat.get(c.startBeat);
      expect(note).toBeDefined();
      const rootPc = pitchClassOf(parseChordSymbol(c.symbol).root);
      expect(pitchClassOf(note!.pitch!)).toBe(rootPc);
    }
  });
  it("two chords in one bar: still one note per beat", () => {
    expect(walkingLine(flatOf("Dm7 G7 | Cmaj7 |"))).toHaveLength(8);
  });
  it("last beat before a new chord chromatically approaches the next root", () => {
    const flat = flatOf("Dm7 | G7 |");
    const line = walkingLine(flat);
    const approach = line.find((e) => e.timeBeats === 3);
    const nextRootPc = pitchClassOf(parseChordSymbol("G7").root);
    expect(pitchClassOf(approach!.pitch!)).toBe((nextRootPc + 11) % 12);
  });
  it("stays in bass register (MIDI 28..60)", () => {
    for (const p of PRESETS) {
      const flat = flattenProgression(p.bars);
      for (const e of walkingLine(flat)) expect(midiOf(e.pitch!)).toBeGreaterThanOrEqual(28);
    }
  });
  it("property: every preset generates without throwing; beats cover the chorus", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PRESETS), (p) => {
        const flat = flattenProgression(p.bars);
        const total = flat.reduce((n, c) => n + c.beats, 0);
        const line = walkingLine(flat);
        expect(line.length).toBe(Math.floor(total));
        for (const e of line) expect(e.timeBeats).toBeLessThan(total);
      }),
    );
  });
});

describe("band.comping", () => {
  it("produces 3+7 shell events only on piano voice", () => {
    const evts = compingVoicings(flatOf("Dm7 G7 | Cmaj7 |"), "swing");
    expect(evts.length).toBeGreaterThan(0);
    expect(evts.every((e) => e.voice === "piano")).toBe(true);
    for (const e of evts) expect(midiOf(e.pitch!)).toBeGreaterThanOrEqual(50);
  });
});

describe("band.drums", () => {
  it("all styles produce a finite grid within the chorus", () => {
    const flat = flatOf("Dm7 G7 | Cmaj7 | Cmaj7 |");
    for (const style of BAND_STYLES) {
      const grid = drumGrid(flat, style);
      expect(grid.length).toBeGreaterThan(0);
      expect(grid.every((e) => e.timeBeats < 16)).toBe(true);
    }
  });
  it("swing 'and' hits land on triplet subdivisions", () => {
    const grid = drumGrid(flatOf("Cmaj7 |"), "swing");
    const offBeat = grid.filter((e) => e.drum === "ride" && Math.abs((e.timeBeats % 1) - 2 / 3) < 1e-6);
    expect(offBeat.length).toBe(2);
  });
});

describe("band.buildChorus", () => {
  it("gates parts; merged events stay sorted", () => {
    const flat = flatOf("Dm7 G7 | Cmaj7 |");
    const full = buildChorus(flat, "swing", partAll);
    const drumsOnly = buildChorus(flat, "swing", { bass: false, piano: false, drums: true, tempoBpm: 120 });
    expect(full.events.some((e) => e.voice === "bass")).toBe(true);
    expect(drumsOnly.events.every((e) => e.voice === "drums")).toBe(true);
    for (let i = 1; i < full.events.length; i++) expect(full.events[i]!.timeBeats).toBeGreaterThanOrEqual(full.events[i - 1]!.timeBeats);
  });
  it("lick line rides on top of the band (solo chorus)", () => {
    const flat = flatOf("Dm7 G7 | Cmaj7 |");
    const lick = placeLickOnBeat(
      [{ pitch: { letter: "D", accidental: 0, octave: 3 }, startBeat: 0, durationBeats: 1 }],
      2,
    );
    const plan = buildChorus(flat, "swing", partAll, lick);
    const lickNotes = plan.events.filter((e) => e.voice === "lick");
    expect(lickNotes).toHaveLength(1);
    expect(lickNotes[0]!.timeBeats).toBe(2);
  });
});

describe("band.musicality (clean-room section model)", () => {
  it("bass never repeats the same pitch twice in a row, stays in register", () => {
    const flat = flatOf("Dm7 | G7 | Cmaj7 | A7 |");
    const line = walkingLine(flat);
    for (let i = 1; i < line.length; i++) expect(line[i]!.midi).not.toBe(line[i - 1]!.midi);
    for (const e of line) {
      expect(e.midi).toBeGreaterThanOrEqual(28);
      expect(e.midi).toBeLessThanOrEqual(60);
    }
  });
  it("odd-bar approach comes chromatically from above the next root", () => {
    const flat = flatOf("Dm7 | G7 | Cmaj7 | G7 |");
    const line = walkingLine(flat);
    // beat 7 is the last beat of the bar-1 G7, approaching Cmaj7 (C) from above.
    const approach = line.find((e) => e.timeBeats === 7);
    const nextRootPc = pitchClassOf(parseChordSymbol("Cmaj7").root);
    expect(pitchClassOf(approach!.pitch!)).toBe((nextRootPc + 1) % 12);
  });
  it("piano plays 3-note voice-led shells with minimal top motion", () => {
    const flat = flatOf("Dm7 | G7 | Cmaj7 |");
    const evts = compingVoicings(flat, "swing");
    expect(evts.length % 3).toBe(0);
    for (const e of evts) {
      expect(midiOf(e.pitch!)).toBeGreaterThanOrEqual(50);
      expect(midiOf(e.pitch!)).toBeLessThanOrEqual(80);
    }
    const tops: number[] = [];
    const byTime = new Map<number, number[]>();
    for (const e of evts) byTime.set(e.timeBeats, [...(byTime.get(e.timeBeats) ?? []), e.midi ?? 0]);
    for (const [, midis] of [...byTime.entries()].sort((a, b) => a[0] - b[0])) tops.push(Math.max(...midis));
    for (let i = 1; i < tops.length; i++) expect(Math.abs(tops[i]! - tops[i - 1]!)).toBeLessThanOrEqual(7);
  });
  it("swing drums mark the form top and ghost-comp on bar 2", () => {
    const flat = flatOf("Cmaj7 | Cmaj7 |");
    const grid = drumGrid(flat, "swing");
    expect(grid.some((e) => e.drum === "crash" && e.timeBeats === 0)).toBe(true);
    expect(grid.some((e) => e.drum === "snare" && Math.abs(e.timeBeats - (4 + 2 + 2 / 3)) < 1e-6)).toBe(true);
  });
  it("swing fill bar plays a turnaround instead of ghosts", () => {
    const flat = flatOf("Cmaj7 | Cmaj7 | Cmaj7 | Cmaj7 |");
    const grid = drumGrid(flat, "swing");
    const fillSnares = grid.filter((e) => e.drum === "snare" && e.timeBeats >= 12 && e.timeBeats < 16);
    expect(fillSnares.length).toBeGreaterThanOrEqual(3);
  });
});

describe("band.chordAtBeat (playhead lookup)", () => {
  it("finds the sounding chord; null outside the chorus", () => {
    const flat = flatOf("Dm7 G7 | Cmaj7 |");
    expect(chordAtBeat(flat, 0)?.chord.symbol).toBe("Dm7");
    expect(chordAtBeat(flat, 2)?.chord.symbol).toBe("G7");
    expect(chordAtBeat(flat, 4)?.chord.symbol).toBe("Cmaj7");
    expect(chordAtBeat(flat, 7.99)?.chord.symbol).toBe("Cmaj7");
    expect(chordAtBeat(flat, -0.5)).toBeNull();
    expect(chordAtBeat(flat, 8)).toBeNull();
    expect(chordAtBeat([], 0)).toBeNull();
  });
});
