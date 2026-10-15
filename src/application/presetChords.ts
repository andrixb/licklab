// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/presetChords: progression presets as a view-model for the
// workspace chips (pure data access + display formatting, no playback).
// Lives in application (not the composition root) so the lazy workspace
// view can use it without pulling the whole composition graph — and the
// domain chord reader it touches stays out of the initial chunk (ADR-023).

import { PRESETS, type Preset } from "../domain/progression.js";

/** Preset chips (id + title + bars), in display order. */
export function presetList(): readonly Preset[] {
  return PRESETS;
}

/** Render a preset's bars as the workspace chord-input string. */
export function chordsOfPreset(presetId: string): string {
  const p = PRESETS.find((x) => x.id === presetId);
  if (!p) throw new Error("unknown preset");
  return p.bars.map((b) => b.chords.map((c) => c.symbol).join(" ")).join(" | ");
}
