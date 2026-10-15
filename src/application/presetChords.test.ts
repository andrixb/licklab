// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { chordsOfPreset, presetList } from "./presetChords.js";

describe("presetChords view-model", () => {
  it("lists presets with stable ids", () => {
    const ids = presetList().map((p) => p.id);
    expect(ids).toContain("blues-f");
    expect(ids).toContain("iiv-i-major");
  });
  it("renders a preset as the workspace chord-input string", () => {
    expect(chordsOfPreset("iiv-i-major")).toBe("Dm7 | G7 | Cmaj7 | Cmaj7");
    expect(chordsOfPreset("blues-f")).toMatch(/^F7 \| Bb7 \|/);
  });
  it("rejects unknown presets", () => {
    expect(() => chordsOfPreset("nope")).toThrow();
  });
});
