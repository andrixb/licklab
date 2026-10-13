// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { parseTypedBars, songBeats, SongValidationError, type Song } from "./song.js";

describe("parseTypedBars", () => {
  it("parses a ii-V-I with bar lines", () => {
    const bars = parseTypedBars("Dm7 G7 | Cmaj7 |");
    expect(bars).toEqual([
      { chord: "Dm7", beats: 2 },
      { chord: "G7", beats: 2 },
      { chord: "Cmaj7", beats: 4 },
    ]);
  });
  it("rejects garbage", () => {
    expect(() => parseTypedBars("   |  ")).toThrow(SongValidationError);
    expect(() => parseTypedBars("H7 |")).toThrow(SongValidationError);
    expect(() => parseTypedBars(Array.from({ length: 513 }, () => "C7").join(" | "))).toThrow(SongValidationError);
  });
});

describe("songBeats", () => {
  it("sums sections", () => {
    const song: Song = {
      id: "s1",
      title: "Example",
      composer: "Anon",
      key: "C",
      form: [{ name: "A", bars: [{ chord: "Dm7", beats: 2 }, { chord: "G7", beats: 2 }] }],
      externalUrl: "",
      origin: "typed",
      ownerId: "o1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      schemaVersion: 1,
    };
    expect(songBeats(song)).toBe(4);
  });
});
