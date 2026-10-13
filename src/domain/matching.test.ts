// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { contextFits, rankProgression, rankSegment, tierFor, type CatalogLick } from "./matching.js";
import { analyzeChords, flattenProgression, type Segment } from "./progression.js";
import { transposeChordSymbol } from "./transpose.js";
import type { Lick, LickChord } from "./lick.js";
import { validLick } from "./lick.test.js";

const chords = (...symbols: string[]): LickChord[] => symbols.map((symbol) => ({ symbol, beats: 4 }));
const segmentsOf = (...symbols: string[]): Segment[] => {
  const cs = chords(...symbols);
  const flat = flattenProgression(cs.map((c) => ({ chords: [c] })));
  return analyzeChords(cs, flat);
};

const cat = (lick: Lick, likes = 0): CatalogLick => ({ lick, likes });

describe("matching.tierFor", () => {
  it("tier 1: exact context window inside the segment", () => {
    const [iivi] = segmentsOf("Dm7", "G7", "Cmaj7");
    const lick = validLick({ harmonicContext: { chords: chords("Dm7", "G7", "Cmaj7"), originalKey: "C", function: "ii-V-I major" } });
    expect(tierFor(lick, iivi!)).toBe(1);
    // A ii-V lick is a contiguous window of the ii-V-I segment -> tier 1.
    const iiv = validLick({ harmonicContext: { chords: chords("Dm7", "G7"), originalKey: "C", function: "ii-V-I major" } });
    expect(tierFor(iiv, iivi!)).toBe(1);
  });
  it("tier 2: same function, lick not longer than segment", () => {
    const [turn] = segmentsOf("Cmaj7", "Am7", "Dm7", "G7");
    // A different 4-chord spelling that is NOT the turnaround shape (so not tier 1),
    // but carries the same derived functionKey -> tier 2.
    const lick = validLick({ harmonicContext: { chords: chords("Cmaj7", "E7", "Am7", "A7"), originalKey: "C", function: "turnaround" } });
    const forced = { ...lick, functionKey: "turnaround.maj" } as Lick;
    expect(tierFor(lick, turn!)).toBeNull(); // unforced: no tier
    expect(tierFor(forced, turn!)).toBe(2);
  });
  it("tier 3: single-chord quality present in segment (no exact window)", () => {
    const [seg] = segmentsOf("Dm7", "G7", "Cmaj7");
    // 2-beat dom7 lick: same quality inside the segment, but the exact
    // 2-beat context never occurs as a window -> quality tier.
    const domLick = validLick({
      pattern: [{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 }],
      harmonicContext: { chords: [{ symbol: "G7", beats: 2 }], originalKey: "G", function: "dom7" },
    });
    expect(domLick.chordQuality).toBe("dom7");
    expect(tierFor(domLick, seg!)).toBe(3);
  });
  it("never overflows: a 4-chord lick does not match a 3-chord ii-V-I", () => {
    const [iivi] = segmentsOf("Dm7", "G7", "Cmaj7");
    const long = validLick({ harmonicContext: { chords: chords("Cmaj7", "Am7", "Dm7", "G7"), originalKey: "C", function: "turnaround" } });
    expect(tierFor(long, iivi!)).toBeNull();
  });
  it("no match for unrelated quality", () => {
    const [seg] = segmentsOf("Cmaj7");
    const lick = validLick({ harmonicContext: { chords: chords("G7"), originalKey: "G", function: "dom7" } });
    expect(tierFor(lick, seg!)).toBeNull();
  });
});

describe("matching.ranking", () => {
  it("orders by tier, then likes, then recency", () => {
    const [seg] = segmentsOf("Dm7", "G7", "Cmaj7");
    const exact = validLick({ id: "exact", harmonicContext: { chords: chords("Dm7", "G7", "Cmaj7"), originalKey: "C", function: "ii-V-I major" } });
    const short = [{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 }];
    const domFewLikes = validLick({ id: "dom-lo", pattern: short, harmonicContext: { chords: [{ symbol: "G7", beats: 2 }], originalKey: "G", function: "dom7" } });
    const domManyLikes = validLick({ id: "dom-hi", pattern: short, harmonicContext: { chords: [{ symbol: "G7", beats: 2 }], originalKey: "G", function: "dom7" } });
    const matches = rankSegment(seg!, [
      cat(domManyLikes, 50),
      cat(domFewLikes, 1),
      cat(exact, 0),
    ]);
    expect(matches.map((m) => [m.lick.id, m.tier])).toEqual([
      ["exact", 1],
      ["dom-hi", 3],
      ["dom-lo", 3],
    ]);
  });
  it("skips deleted licks", () => {
    const [seg] = segmentsOf("G7");
    const gone = validLick({ deletedAt: "2026-02-01T00:00:00.000Z", harmonicContext: { chords: chords("G7"), originalKey: "G", function: "dom7" } });
    expect(rankSegment(seg!, [cat(gone)])).toHaveLength(0);
  });
  it("rankProgression returns one list per segment", () => {
    const segs = segmentsOf("Dm7", "G7", "Cmaj7");
    const out = rankProgression(segs, []);
    expect(out).toHaveLength(segs.length);
  });
});

describe("matching.contextFits", () => {
  it("contiguous window match, order matters, empty never fits", () => {
    const seg = chords("Cmaj7", "Am7", "Dm7", "G7");
    expect(contextFits(chords("Am7", "Dm7"), seg)).toBe(true);
    expect(contextFits(chords("Dm7", "Am7"), seg)).toBe(false);
    expect(contextFits([], seg)).toBe(false);
    expect(contextFits(chords("Cmaj7", "Am7", "Dm7", "G7", "Cmaj7"), seg)).toBe(false);
  });
});

describe("matching.transposition invariance (property)", () => {
  it("matching a lick to a segment is invariant under transposing both", () => {
    const shift = (cs: LickChord[], n: number): LickChord[] => cs.map((c) => ({ symbol: transposeChordSymbol(c.symbol, n), beats: c.beats }));
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 11 }), (n) => {
        const baseSeg = segmentsOf("Dm7", "G7", "Cmaj7")[0]!;
        const lick = validLick({ harmonicContext: { chords: chords("Dm7", "G7", "Cmaj7"), originalKey: "C", function: "ii-V-I major" } });
        const moved = segmentsOf(...shift(chords("Dm7", "G7", "Cmaj7"), n).map((c) => c.symbol))[0]!;
        const lickMoved = validLick({ harmonicContext: { chords: shift(chords("Dm7", "G7", "Cmaj7"), n), originalKey: "C", function: "ii-V-I major" } });
        expect(tierFor(lickMoved, moved)).toBe(tierFor(lick, baseSeg));
      }),
    );
  });
});
