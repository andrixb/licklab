// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import {
  analyzeChords,
  flattenProgression,
  isBlues12,
  parseProgressionInput,
  PRESETS,
  type Progression,
} from "./progression.js";
import { analyzeProgression } from "./progression.js";
import { contextKeyOf, signatureOf } from "./signatures.js";
import type { LickChord } from "./lick.js";

const chords = (...symbols: string[]): LickChord[] => symbols.map((symbol) => ({ symbol, beats: 4 }));
const flatOf = (cs: LickChord[]) => flattenProgression(cs.map((c) => ({ chords: [c] })));

describe("progression.parse", () => {
  it("parses typed bars with per-bar split", () => {
    const bars = parseProgressionInput("Dm7 G7 | Cmaj7 |");
    expect(bars).toHaveLength(2);
    expect(bars[0]!.chords).toEqual([
      { symbol: "Dm7", beats: 2 },
      { symbol: "G7", beats: 2 },
    ]);
    expect(bars[1]!.chords).toEqual([{ symbol: "Cmaj7", beats: 4 }]);
  });
  it("rejects unparseable chords, >4 per bar, empty", () => {
    expect(() => parseProgressionInput("H7 |")).toThrow();
    expect(() => parseProgressionInput("C |")).not.toThrow();
    expect(() => parseProgressionInput("||")).toThrow();
    expect(() => parseProgressionInput("C7 C7 C7 C7 C7 |")).toThrow();
  });
});

describe("progression.analyzer", () => {
  it("ii-V-I preset yields one multi-chord segment + leftover chord", () => {
    const preset = PRESETS.find((p) => p.id === "iiv-i-major")!;
    const segments = analyzeChords(
      preset.bars.flatMap((b) => b.chords),
      flattenProgression(preset.bars),
    );
    expect(segments[0]!.functionKey).toBe("ii-V-I.maj");
    expect(segments[0]!.chords).toHaveLength(3);
    expect(segments[1]!.functionKey).toBe("static.maj");
    expect(segments[0]!.startBeat).toBe(0);
    expect(segments[0]!.endBeat).toBe(12);
  });
  it("two-bar typed input finds the ii-V", () => {
    const segments = analyzeChords(chords("Dm7", "G7"), flatOf(chords("Dm7", "G7")));
    expect(segments).toHaveLength(1);
    expect(segments[0]!.functionKey).toBe("ii-V");
  });
  it("blues in F collapses to one blues.12bar segment", () => {
    const blues = chords("F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "F7", "C7", "Bb7", "F7", "C7");
    expect(isBlues12(signatureOf(blues))).toBe(true);
    const segments = analyzeChords(blues, flatOf(blues));
    expect(segments).toHaveLength(1);
    expect(segments[0]!.functionKey).toBe("blues.12bar");
    expect(segments[0]!.endBeat).toBe(48);
  });
  it("rhythm changes A: turnaround, then Em7-A7-Dm7 reads as a minor ii-V-i", () => {
    const rhythm = chords("Cmaj7", "Am7", "Dm7", "G7", "Em7", "A7", "Dm7", "G7");
    const segments = analyzeChords(rhythm, flatOf(rhythm));
    expect(segments.map((s) => s.functionKey)).toEqual(["turnaround.maj", "ii-V-i.min", "dom"]);
  });
  it("uncovered chords become single-chord segments", () => {
    const segments = analyzeChords(chords("Cmaj7", "Fmaj7", "G7"), flatOf(chords("Cmaj7", "Fmaj7", "G7")));
    expect(segments[0]!.functionKey).toBe("static.maj");
    expect(segments.some((s) => s.functionKey === "V-I.maj")).toBe(false); // Fmaj7 blocks it
  });
  it("empty input, empty result", () => {
    expect(analyzeChords([], [])).toEqual([]);
  });
});

describe("progression presets", () => {
  it("every preset analyzes without throwing", () => {
    for (const p of PRESETS) {
      const flat = flattenProgression(p.bars);
      const segs = analyzeChords(flat.map((c) => ({ symbol: c.symbol, beats: c.beats })), flat);
      expect(segs.length).toBeGreaterThan(0);
      for (const s of segs) expect(s.contextKey).toBe(contextKeyOf(s.chords));
    }
  });
  it("analyzeProgression works on an entity", () => {
    const p: Progression = {
      id: "p1",
      title: "Test",
      key: "C",
      bars: parseProgressionInput("Dm7 G7 | Cmaj7"),
      ownerId: "o",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      schemaVersion: 1,
    };
    const segs = analyzeProgression(p);
    expect(segs[0]!.functionKey).toBe("ii-V-I.maj");
  });
});
