// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/playback: use cases that turn a progression (+ optional lick
// placements) into AudioEngine playbacks. All planning is domain-pure; this
// only wires ports. Never imports Tone (that's the adapter's job).

import type { AudioEngine, BandPlayback } from "./ports.js";
import {
  buildChorus,
  chorusSeconds,
  placeLickOnBeat,
  toTimedEvents,
  type BandPart,
  type BandStyle,
  type TimedEvent,
} from "../domain/band.js";
import { parseChordSymbol } from "../domain/chords.js";
import type { Lick } from "../domain/lick.js";
import { flattenProgression, type ProgressionBar, type Segment } from "../domain/progression.js";
import { placementFor } from "../domain/matching.js";
import { transposeChordSymbol, transposeLick } from "../domain/transpose.js";

export interface PlayOptions {
  readonly style: BandStyle;
  readonly tempoBpm: number;
  readonly parts: BandPart;
}

function flatOf(bars: readonly ProgressionBar[]) {
  return flattenProgression(bars);
}

/** Band-only chorus (progression audition). */
export function playChorus(engine: AudioEngine, bars: readonly ProgressionBar[], opts: PlayOptions): BandPlayback {
  const flat = flatOf(bars);
  const plan = buildChorus(flat, opts.style, opts.parts);
  return engine.play(toTimedEvents(plan, opts.tempoBpm), chorusSeconds(plan, opts.tempoBpm));
}

/**
 * Audition ONE lick over the progression: the lick rides the first fitting
 * segment placement; band plays the full chorus.
 */
export function auditionLick(
  engine: AudioEngine,
  bars: readonly ProgressionBar[],
  segments: readonly Segment[],
  lick: Lick,
  opts: PlayOptions,
): BandPlayback | null {
  const flat = flatOf(bars);
  let line: ReturnType<typeof transposeLick> | null = null;
  for (const seg of segments) {
    const placed = placementFor(lick, seg);
    if (!placed) continue;
    const sounding = transposeLick(lick, parseChordSymbol(placed.targetRootSymbol).root);
    line = placeLickOnBeat(sounding, placed.startBeat);
    break;
  }
  if (!line) return null;
  const plan = buildChorus(flat, opts.style, opts.parts, line);
  return engine.play(toTimedEvents(plan, opts.tempoBpm), chorusSeconds(plan, opts.tempoBpm));
}

/**
 * Solo chorus: play the whole progression with each placed lick inserted at
 * its placement beat (user-chosen licks across the form).
 */
export function playSoloChorus(
  engine: AudioEngine,
  bars: readonly ProgressionBar[],
  segments: readonly Segment[],
  placements: readonly { lick: Lick; segmentIndex: number }[],
  opts: PlayOptions,
): BandPlayback {
  const flat = flatOf(bars);
  let line: ReturnType<typeof transposeLick> = [];
  for (const p of placements) {
    const seg = segments[p.segmentIndex];
    if (!seg) continue;
    const placed = placementFor(p.lick, seg);
    if (!placed) continue;
    const sounding = transposeLick(p.lick, parseChordSymbol(placed.targetRootSymbol).root);
    line = [...line, ...placeLickOnBeat(sounding, placed.startBeat)];
  }
  const plan = buildChorus(flat, opts.style, opts.parts, line);
  return engine.play(toTimedEvents(plan, opts.tempoBpm), chorusSeconds(plan, opts.tempoBpm));
}

/**
 * All-12-keys: the lick's own context + band, transposed through 12 roots,
 * played as one long concatenated plan (earbop-style key cycle).
 */
export function playTwelveKeys(engine: AudioEngine, lick: Lick, opts: PlayOptions): BandPlayback {
  const timed: TimedEvent[] = [];
  let beatCursor = 0;
  let totalBeats = 0;
  for (let k = 0; k < 12; k++) {
    const bars: ProgressionBar[] = lick.harmonicContext.chords.map((c) => ({
      chords: [{ symbol: transposeChordSymbol(c.symbol, k), beats: c.beats }],
    }));
    const flat = flatOf(bars);
    const anchor = flat[0];
    if (!anchor) throw new Error("lick context produced no chords");
    const plan = buildChorus(flat, opts.style, opts.parts, placeLickOnBeat(transposeLick(lick, parseChordSymbol(anchor.symbol).root), 0));
    const shift = beatCursor;
    for (const e of toTimedEvents(plan, opts.tempoBpm, 0)) {
      timed.push({ ...e, timeSeconds: e.timeSeconds + shift * (60 / opts.tempoBpm) });
    }
    beatCursor += plan.totalBeats;
    totalBeats += plan.totalBeats;
  }
  const spb = 60 / opts.tempoBpm;
  return engine.play(timed, totalBeats * spb + 4 * spb);
}
