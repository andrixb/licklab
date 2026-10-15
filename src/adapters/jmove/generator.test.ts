// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// JMove adapter parity: LickLab must hand JMove exactly what JMove expects,
// and sound what JMove computes. The oracle is JMove itself
// (getChordIntervals / getQualityScale / generateEnsemble), never a
// hand-written theory table.

import { describe, expect, it } from "vitest";
import {
  generateEnsemble,
  getChordIntervals,
  getQualityScale,
  resolveBassGranular,
  resolveDrumGranular,
  resolvePianoGranular,
} from "@jmove/generator";
import { flattenProgression, parseProgressionInput } from "../../domain/progression.js";
import { createJmoveBandProvider, jmoveRootName, toChordEvents } from "./generator.js";
import { parsePitchName } from "../../domain/pitch.js";

const pc = (midi: number): number => ((Math.round(midi) % 12) + 12) % 12;

describe("toChordEvents passes symbols through in JMove-canonical form", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    // [symbol, expected root, expected quality]
    ["Bb7", "Bb", "7"],
    ["Eb7", "Eb", "7"],
    ["F7", "F", "7"],
    ["Dm7", "D", "m7"],
    ["G7", "G", "7"],
    ["Cmaj7", "C", "maj7"],
    ["Dm7b5", "D", "m7b5"],
    ["Cm7", "C", "m7"],
    ["Bb7#9", "Bb", "7#9"],
    ["Bb7b9", "Bb", "7b9"],
    ["Bb13", "Bb", "13"],
    ["Bb9", "Bb", "9"],
    ["G7alt", "G", "7alt"],
    ["C9sus", "C", "9sus"],
    ["C13sus", "C", "13sus"],
    ["C7sus4", "C", "7sus4"],
    ["Csus2", "C", "sus2"],
    ["Bbmaj7", "Bb", "maj7"],
    ["Bbm7", "Bb", "m7"],
    ["Bbdim7", "Bb", "dim7"],
    ["Bbdim", "Bb", "dim"],
    ["Bb6", "Bb", "6"],
    ["Bb69", "Bb", "69"],
    ["Bbm6", "Bb", "m6"],
    ["Bbaug", "Bb", "aug"],
    ["Bb+7", "Bb", "+7"],
    ["Bbm(maj7)", "Bb", "m(maj7)"],
    ["F#m7", "F#", "m7"],
    ["Db7#11", "Db", "7#11"],
    // Documented aliases (ADR-023): LickLab accepts, JMove receives canonical.
    ["CM7", "C", "maj7"],
    ["CΔ7", "C", "maj7"],
    ["C°7", "C", "o7"],
    ["CmMaj7", "C", "m(maj7)"],
    ["Cpower5", "C", "5"],
    ["C7+", "C", "7#5"],
    ["Calt", "C", "7alt"],
    ["C-7", "C", "-7"],
    ["Cmin7", "C", "min7"],
    ["C^7", "C", "^7"],
    ["Cø", "C", "ø"],
    ["Co7", "C", "o7"],
    ["Ch7", "C", "h7"],
  ];
  for (const [symbol, root, quality] of cases) {
    it(`${symbol} -> root ${root}, quality "${quality}" (verbatim, never simplified)`, () => {
      const flat = flattenProgression(parseProgressionInput(symbol));
      const events = toChordEvents(flat, 120);
      expect(events).toHaveLength(1);
      expect(events[0]?.root).toBe(root);
      expect(events[0]?.quality).toBe(quality);
      // Timing: beats -> seconds at the given tempo.
      expect(events[0]?.time).toBeCloseTo(0, 10);
      expect(events[0]?.duration).toBeCloseTo(4 / (120 / 60), 10);
    });
  }
  it("multi-chord bars keep each chord's start time", () => {
    const flat = flattenProgression(parseProgressionInput("Dm7 G7 | Cmaj7 |"));
    const events = toChordEvents(flat, 120);
    expect(events.map((e) => [e.root, e.quality, e.time])).toEqual([
      ["D", "m7", 0],
      ["G", "7", 1],
      ["C", "maj7", 2],
    ]);
  });
  it("slash bass parses without altering the generator input (JMove strips it)", () => {
    const flat = flattenProgression(parseProgressionInput("Bb7/D | Cmaj7 |"));
    const events = toChordEvents(flat, 120);
    expect(events[0]?.root).toBe("Bb");
    expect(events[0]?.quality).toBe("7");
  });
});

describe("jmoveRootName", () => {
  it("single accidentals pass through untouched (JMove reads # and b identically)", () => {
    for (const name of ["C", "Bb", "F#", "Eb", "Db", "G", "B", "Fb", "Cb"]) {
      expect(jmoveRootName(parsePitchName(name, 4))).toBe(name);
    }
  });
  it("double accidentals respell to single-accidental enharmonics deterministically", () => {
    expect(jmoveRootName(parsePitchName("Ebb", 4))).toBe("D");
    expect(jmoveRootName(parsePitchName("Abb", 4))).toBe("G");
    expect(jmoveRootName(parsePitchName("Bbb", 4))).toBe("A");
    expect(jmoveRootName(parsePitchName("Bx", 4))).toBe("Db");
    expect(jmoveRootName(parsePitchName("Fbb", 4))).toBe("Eb");
  });
});

describe("generateBand sounds JMove's own chord tones (fixed seed)", () => {
  const provider = createJmoveBandProvider();
  const zero = {
    seed: 11, creativity: 0, conversation: 0, airGaps: 0, harmonicFreedom: 0,
    density: 50, swingAmount: 50, strumMs: 0,
    drumComplexity: 0, pianoComplexity: 0, bassComplexity: 0,
  } as const;

  it("is deterministic per seed", async () => {
    const flat = flattenProgression(parseProgressionInput("Bb7 | Eb7 | F7 |"));
    const part = { bass: true, piano: true, drums: true, tempoBpm: 120 };
    const a = await provider.generateBand(flat, "swing", part, 120, { ...zero });
    const b = await provider.generateBand(flat, "swing", part, 120, { ...zero });
    expect(a).toEqual(b);
  });

  // Isolated one-bar charts (no chord changes, so no anticipation or
  // approach-note confounds): the aggregate must contain JMove's own core
  // third and seventh, and every note must belong to JMove's own scale —
  // except Caug, where JMove itself voices a major-7th shell ([3, 7] =
  // its maj7#5 color, observed seed-pinned) outside the whole-tone scale.
  const cores: ReadonlyArray<readonly [string, string]> = [
    ["C7", "7"], ["Cmaj7", "maj7"], ["Cm7", "m7"], ["Cm7b5", "m7b5"],
    ["Cdim7", "dim7"], ["C6", "6"], ["Cm6", "m6"], ["C7#9", "7#9"],
    ["C7b9", "7b9"], ["C13", "13"], ["C7sus4", "7sus4"], ["Caug", "aug"],
    ["Cm(maj7)", "m(maj7)"],
  ];
  for (const [symbol, quality] of cores) {
    it(`${symbol}: piano aggregate holds JMove's 3rd+7th, all notes in JMove's scale`, async () => {
      const flat = flattenProgression(parseProgressionInput(symbol));
      const part = { bass: false, piano: true, drums: false, tempoBpm: 120 };
      const events = await provider.generateBand(flat, "swing", part, 120, { ...zero });
      expect(events.length).toBeGreaterThan(0);
      // All test chords are C-rooted (pc 0), so pitch class IS the JMove interval.
      const scalePcs = new Set(getQualityScale(quality).map((iv) => iv % 12));
      const core = getChordIntervals(quality);
      const third = core[1] as number;
      const seventh = core[3] as number | undefined;
      const pcs = events.map((e) => pc(e.midi ?? -1));
      const allowed = symbol === "Caug" ? new Set([0, 4, 8, 11]) : scalePcs;
      for (const p of pcs) expect(allowed.has(p), `${symbol} piano midi pc ${p} outside JMove vocabulary`).toBe(true);
      // C root = pc 0, so pitch class IS the interval here.
      expect(pcs, `${symbol} missing JMove 3rd ${third}`).toContain(third % 12);
      if (seventh !== undefined) expect(pcs, `${symbol} missing JMove 7th ${seventh}`).toContain(seventh % 12);
    });
  }

  it("matches direct JMove output event-for-event (no drift between adapter and library)", async () => {
    const flat = flattenProgression(parseProgressionInput("Dm7 | G7 | Cmaj7 |"));
    const part = { bass: true, piano: true, drums: false, tempoBpm: 120 };
    const viaAdapter = await provider.generateBand(flat, "swing", part, 120, { ...zero });
    const chordEvents = toChordEvents(flat, 120);
    // Same translation the adapter applies (BandGenerateOptions -> ensemble
    // params); any drift between the two call sites fails this test.
    const direct = generateEnsemble({
      chordEvents,
      style: "swing",
      tempo: 120,
      timeSignature: [4, 4],
      measures: 3,
      measureInfo: { totalMeasures: 3, measureDuration: 2 },
      instrumentStyles: { bass: "swing", piano: "swing", drums: "swing" },
      seed: zero.seed,
      density: zero.density,
      swingAmount: zero.swingAmount,
      strumMs: zero.strumMs,
      creativity: zero.creativity,
      conversation: zero.conversation,
      airGaps: zero.airGaps,
      harmonicFreedom: zero.harmonicFreedom,
      drumGranular: resolveDrumGranular(zero.drumComplexity),
      pianoGranular: resolvePianoGranular(zero.pianoComplexity),
      bassGranular: resolveBassGranular(zero.bassComplexity),
    });
    const bps = 2;
    const directMidis = [
      ...direct.bass.map((n) => ({ voice: "bass", midi: n.pitch, t: n.time * bps })),
      ...direct.piano.flatMap((n) => n.pitches.map((p) => ({ voice: "piano", midi: p, t: n.time * bps }))),
    ].sort((a, b) => a.t - b.t || a.midi - b.midi);
    const adapterMidis = [...viaAdapter]
      .sort((a, b) => a.timeBeats - b.timeBeats || (a.midi ?? 0) - (b.midi ?? 0))
      .map((e) => ({ voice: e.voice, midi: e.midi, t: e.timeBeats }));
    expect(adapterMidis).toEqual(directMidis);
  });
});
