// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { BAND_STYLES, buildChorus, compingVoicings, drumGrid, placeLickOnBeat, walkingLine, type BandPart } from "./band.js";
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
