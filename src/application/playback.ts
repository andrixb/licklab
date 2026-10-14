// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/playback: use cases that turn a progression (+ optional lick
// placements) into AudioEngine playbacks. All planning is domain-pure; this
// only wires ports. Never imports Tone (that's the adapter's job).
//
// The band pattern source is a BandPatternProvider (local domain engine by
// default, lazy jmove adapter when the caller passes one) — use cases stay
// engine-agnostic; the lick overlay, count-in and mix levels apply uniformly.

import type { AudioEngine, BandGenerateOptions, BandLevels, BandPatternProvider, BandPlayback, BandPlayOpts } from "./ports.js";
import {
  buildChorus,
  chorusSeconds,
  placeLickOnBeat,
  toTimedEvents,
  type BandEvent,
  type BandPart,
  type BandStyle,
  type ChorusPlan,
  type TimedEvent,
} from "../domain/band.js";
import { parseChordSymbol } from "../domain/chords.js";
import { midiOf } from "../domain/pitch.js";
import type { Lick } from "../domain/lick.js";
import { flattenProgression, type FlatChord, type ProgressionBar, type Segment } from "../domain/progression.js";
import { placementFor } from "../domain/matching.js";
import { transposeChordSymbol, transposeLick, type SoundingNote } from "../domain/transpose.js";

export interface PlayOptions {
  readonly style: BandStyle;
  readonly tempoBpm: number;
  readonly parts: BandPart;
  /** Pattern source; defaults to the local domain engine. */
  readonly provider?: BandPatternProvider;
  readonly bandOpts?: BandGenerateOptions;
  /** Beats of count-in silence (Off/1/2 bars); default 4. */
  readonly countInBeats?: number;
  readonly levels?: BandLevels;
  readonly loop?: boolean;
}

function flatOf(bars: readonly ProgressionBar[]) {
  return flattenProgression(bars);
}

function countInOf(opts: PlayOptions): number {
  return opts.countInBeats ?? 4;
}

async function bandEvents(
  flat: readonly FlatChord[],
  opts: PlayOptions,
  lickLine?: readonly SoundingNote[],
): Promise<{ events: BandEvent[]; totalBeats: number }> {
  const totalBeats = flat.reduce((n, c) => n + c.beats, 0);
  const lickEvents: BandEvent[] = (lickLine ?? []).flatMap((n) =>
    n.pitch
      ? [{ voice: "lick" as const, timeBeats: n.startBeat, durationBeats: n.durationBeats, pitch: n.pitch, midi: midiOf(n.pitch) }]
      : [],
  );
  if (opts.provider) {
    const events = [...(await opts.provider.generateBand(flat, opts.style, opts.parts, opts.tempoBpm, opts.bandOpts)), ...lickEvents];
    events.sort((a, b) => a.timeBeats - b.timeBeats || a.voice.localeCompare(b.voice));
    return { events, totalBeats };
  }
  const plan = buildChorus(flat, opts.style, opts.parts, lickLine);
  return { events: [...plan.events], totalBeats: plan.totalBeats };
}

function startPlayback(
  engine: AudioEngine,
  events: readonly BandEvent[],
  totalBeats: number,
  style: BandStyle,
  opts: PlayOptions,
): BandPlayback {
  const plan: ChorusPlan = { events, totalBeats, style };
  const countIn = countInOf(opts);
  const playOpts: BandPlayOpts = {
    ...(opts.levels !== undefined ? { levels: opts.levels } : {}),
    ...(opts.loop !== undefined ? { loop: opts.loop } : {}),
  };
  return engine.play(toTimedEvents(plan, opts.tempoBpm, countIn), chorusSeconds(plan, opts.tempoBpm, countIn), undefined, playOpts);
}

/** Band-only chorus (progression audition). */
export async function playChorus(engine: AudioEngine, bars: readonly ProgressionBar[], opts: PlayOptions): Promise<BandPlayback> {
  const flat = flatOf(bars);
  const { events, totalBeats } = await bandEvents(flat, opts);
  return startPlayback(engine, events, totalBeats, opts.style, opts);
}

/**
 * Audition ONE lick over the progression: the lick rides the first fitting
 * segment placement; band plays the full chorus.
 */
export async function auditionLick(
  engine: AudioEngine,
  bars: readonly ProgressionBar[],
  segments: readonly Segment[],
  lick: Lick,
  opts: PlayOptions,
): Promise<BandPlayback | null> {
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
  const { events, totalBeats } = await bandEvents(flat, opts, line);
  return startPlayback(engine, events, totalBeats, opts.style, opts);
}

/**
 * Solo chorus: play the whole progression with each placed lick inserted at
 * its placement beat (user-chosen licks across the form).
 */
export async function playSoloChorus(
  engine: AudioEngine,
  bars: readonly ProgressionBar[],
  segments: readonly Segment[],
  placements: readonly { lick: Lick; segmentIndex: number }[],
  opts: PlayOptions,
): Promise<BandPlayback> {
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
  const { events, totalBeats } = await bandEvents(flat, opts, line);
  return startPlayback(engine, events, totalBeats, opts.style, opts);
}

/**
 * All-12-keys: the lick's own context + band, transposed through 12 roots,
 * played as one long concatenated plan (earbop-style key cycle).
 */
export async function playTwelveKeys(engine: AudioEngine, lick: Lick, opts: PlayOptions): Promise<BandPlayback> {
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
    const line = placeLickOnBeat(transposeLick(lick, parseChordSymbol(anchor.symbol).root), 0);
    const { events, totalBeats: chorusBeats } = await bandEvents(flat, opts, line);
    const plan: ChorusPlan = { events, totalBeats: chorusBeats, style: opts.style };
    const shift = beatCursor;
    for (const e of toTimedEvents(plan, opts.tempoBpm, 0)) {
      timed.push({ ...e, timeSeconds: e.timeSeconds + shift * (60 / opts.tempoBpm) });
    }
    beatCursor += plan.totalBeats;
    totalBeats += plan.totalBeats;
  }
  const spb = 60 / opts.tempoBpm;
  const playOpts: BandPlayOpts = {
    ...(opts.levels !== undefined ? { levels: opts.levels } : {}),
    ...(opts.loop !== undefined ? { loop: opts.loop } : {}),
  };
  return engine.play(timed, totalBeats * spb + 4 * spb, undefined, playOpts);
}
