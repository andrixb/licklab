// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/local/band: BandPatternProvider over the pure domain engine
// (domain/band.ts). Deterministic, offline, zero dependencies — the fallback
// when the jmove provider is unavailable and the engine for "straight".

import type { BandPatternProvider } from "../../application/ports.js";
import { buildChorus, type BandEvent, type BandPart, type BandStyle } from "../../domain/band.js";
import type { FlatChord } from "../../domain/progression.js";
import type { SoundingNote } from "../../domain/transpose.js";

export function createLocalBandProvider(lickLine?: readonly SoundingNote[]): BandPatternProvider {
  return {
    name: "local",
    async generateBand(flat: readonly FlatChord[], style: BandStyle, part: BandPart): Promise<readonly BandEvent[]> {
      return buildChorus(flat, style, part, lickLine).events;
    },
  };
}
