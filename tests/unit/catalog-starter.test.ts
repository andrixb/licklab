// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// Contract test for the PublicLickCatalog port against the REAL starter-pack
// asset: every lick must parse, plausibility must pass, and each lick must
// tier-1 match at least one shipped preset progression (anonymous offline
// usefulness in one check).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStarterPackCatalog } from "../../src/adapters/catalog/starter-pack.js";
import { checkPlausibility } from "../../src/domain/plausibility.js";
import { flattenProgression, PRESETS } from "../../src/domain/progression.js";
import { contextFits } from "../../src/domain/matching.js";

const catalog = await createStarterPackCatalog(async () =>
  JSON.parse(readFileSync("public/starter-pack.json", "utf8")),
).fetchPublicLicks();

describe("starter pack (contract vs PublicLickCatalog)", () => {
  it("ships 8 valid, public, licensed licks", () => {
    expect(catalog.length).toBe(8);
    for (const { lick } of catalog) {
      expect(lick.visibility).toBe("public");
      expect(lick.license).toBe("CC BY 4.0");
      expect(lick.ownerId).toBe("starter-pack");
      expect(lick.schemaVersion).toBe(2);
    }
  });
  it("every lick is plausible against its own chords", () => {
    for (const { lick } of catalog) {
      const report = checkPlausibility(lick);
      expect(report.warnings.filter((w) => /line up/.test(w))).toEqual([]);
    }
  });
  it("every lick tier-1 matches at least one preset progression", () => {
    for (const { lick } of catalog) {
      const hit = PRESETS.some((p) => contextFits(lick.harmonicContext.chords, flattenProgression(p.bars).map((c) => ({ symbol: c.symbol, beats: c.beats }))));
      expect(hit, `${lick.id} fits no preset`).toBe(true);
    }
  });
});
