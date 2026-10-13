// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  contextBeats,
  LICK_FUNCTIONS,
  LickValidationError,
  parseLick,
  type Lick,
} from "./lick.js";

export function validLick(overrides: Partial<Lick> = {}): Lick {
  return parseLick({
    id: "lick-1",
    title: "Cry Me a River",
    pattern: [
      { steps: 6, semitones: 10, octaveOffset: 0, startBeat: 0, durationBeats: 1 },
      { steps: 4, semitones: 7, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
      { steps: 2, semitones: 3, octaveOffset: 0, startBeat: 2, durationBeats: 2 },
    ],
    harmonicContext: {
      chords: [
        { symbol: "Dm7", beats: 4 },
        { symbol: "G7", beats: 4 },
      ],
      originalKey: "C",
      function: "ii-V-I major",
    },
    source: {
      artist: "LickLab",
      instrument: "bass",
      track: "",
      album: "",
      year: null,
      recordingUrl: "",
      timestampSeconds: null,
      location: "",
    },
    tags: ["minor-ii-V"],
    difficulty: 3,
    notes: "",
    ownerId: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
    schemaVersion: 1,
    ...overrides,
  });
}

describe("parseLick", () => {
  it("accepts a valid lick", () => {
    const lick = validLick();
    expect(lick.title).toBe("Cry Me a River");
    expect(contextBeats(lick)).toBe(8);
  });
  it("rejects bad title, empty pattern, overlaps, bad chords, bad function", () => {
    expect(() => validLick({ title: "  " })).toThrow(LickValidationError);
    expect(() => validLick({ pattern: [] })).toThrow(LickValidationError);
    expect(() =>
      validLick({
        pattern: [
          { steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 2 },
          { steps: 2, semitones: 4, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
        ],
      }),
    ).toThrow(LickValidationError);
    expect(() =>
      validLick({ harmonicContext: { chords: [{ symbol: "H7", beats: 4 }], originalKey: "C", function: "ii-V-I major" } }),
    ).toThrow(LickValidationError);
    expect(() =>
      validLick({ harmonicContext: { chords: [{ symbol: "Dm7", beats: 4 }], originalKey: "C", function: "nope" as never } }),
    ).toThrow(LickValidationError);
    expect(() => parseLick(null)).toThrow(LickValidationError);
    expect(() => validLick({ pattern: [{ steps: 0, semitones: 0, octaveOffset: 0, startBeat: NaN, durationBeats: 1 }] })).toThrow(
      LickValidationError,
    );
    expect(() => validLick({ harmonicContext: { chords: [], originalKey: "C", function: "dom7" } })).toThrow(
      LickValidationError,
    );
    expect(() => validLick({ harmonicContext: { chords: [{ symbol: "C7", beats: 4 }], originalKey: "H", function: "dom7" } })).toThrow(
      LickValidationError,
    );
    expect(() => validLick({ tags: Array.from({ length: 25 }, (_, i) => `t${i}`) })).toThrow(LickValidationError);
    expect(() => validLick({ tags: [42 as never] })).toThrow(LickValidationError);
    expect(() => validLick({ createdAt: "not-a-date" })).toThrow(LickValidationError);
  });
  it("canonicalizes degrees (semitones 0..11)", () => {
    const lick = validLick({
      pattern: [{ steps: 0, semitones: 14, octaveOffset: 0, startBeat: 0, durationBeats: 1 }],
    });
    expect(lick.pattern[0]).toMatchObject({ steps: 7, semitones: 2 });
  });
  it("property: function enum round trips; every function accepted", () => {
    for (const fn of LICK_FUNCTIONS) {
      expect(validLick({ harmonicContext: { chords: [{ symbol: "C7", beats: 4 }], originalKey: "C", function: fn } }).harmonicContext.function).toBe(fn);
    }
    fc.assert(
      fc.property(fc.constantFrom(...LICK_FUNCTIONS), (fn) => {
        expect(() =>
          validLick({ harmonicContext: { chords: [{ symbol: "C7", beats: 4 }], originalKey: "C", function: fn } }),
        ).not.toThrow();
      }),
    );
  });
});
