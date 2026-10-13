// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { findLicksForProgression } from "./matching.js";
import { validLick } from "../domain/lick.test.js";
import { parseProgressionInput, type Progression } from "../domain/progression.js";
import type { CatalogLick } from "../domain/matching.js";

const prog = (input: string): Progression => ({
  id: "p",
  title: "T",
  key: "C",
  bars: parseProgressionInput(input),
  ownerId: "o",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  schemaVersion: 1,
});

describe("findLicksForProgression", () => {
  it("returns ranked matches per analyzed segment", () => {
    const iivI = validLick({
      id: "l1",
      harmonicContext: {
        chords: [
          { symbol: "Dm7", beats: 2 },
          { symbol: "G7", beats: 2 },
          { symbol: "Cmaj7", beats: 4 },
        ],
        originalKey: "C",
        function: "ii-V-I major",
      },
    });
    const out = findLicksForProgression(prog("Dm7 G7 | Cmaj7"), [{ lick: iivI, likes: 2 }]);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]!.segment.functionKey).toBe("ii-V-I.maj");
    expect(out[0]!.matches[0]!.tier).toBe(1);
    expect(out[0]!.matches[0]!.lick.id).toBe("l1");
  });
  it("empty catalog yields empty matches, not an error", () => {
    const out = findLicksForProgression(prog("Dm7 G7 | Cmaj7"), [] as CatalogLick[]);
    expect(out.every((o) => o.matches.length === 0)).toBe(true);
  });
});
