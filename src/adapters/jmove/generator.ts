// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/jmove: BandPatternProvider over @jmove/generator (MIT — allowed by
// docs/legal.md; pinned exact in package.json). The library is lazy-imported
// on first generation so its ~400KB never enters the initial payload (same
// treatment as Tone). Seconds-based MIDI output is converted back to our
// beat-grid BandEvents, so Tone scheduling, mixing and the lick overlay are
// untouched. Anything the library cannot do (unknown style/GM voice) falls
// back to the local domain engine at the composition root, never here.

import type {
  BandGenerateOptions,
  BandPatternProvider,
} from "../../application/ports.js";
import type { BandEvent, BandPart, BandStyle, DrumRole } from "../../domain/band.js";
import { pitchClassOf } from "../../domain/pitch.js";
import { parseChordSymbol, type ChordQuality } from "../../domain/chords.js";
import type { FlatChord } from "../../domain/progression.js";
import type { ChordEvent } from "@jmove/generator";

export const JMOVE_SUPPORTED_STYLES: readonly BandStyle[] = ["swing", "ballad", "bossa"];

/** Our 11 chord qualities → jmove quality strings (see their chordQuality.ts). */
export const QUALITY_MAP: Record<ChordQuality, string> = {
  maj7: "maj7",
  maj6: "6",
  min7: "m7",
  min6: "m6",
  minmaj7: "m(maj7)",
  dom7: "7",
  dim7: "dim7",
  hdim7: "m7b5",
  aug: "aug",
  sus7: "7sus",
  power5: "5",
};

const PC_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

/** Root as a pitch-class name (never exotic spellings like Bbb — jmove parses C/Db/F# only). */
export function rootNameOf(symbol: string): string {
  const pc = pitchClassOf(parseChordSymbol(symbol).root);
  return PC_NAMES[pc] as string;
}

/** Our progression → jmove chord events (times in seconds). */
export function flatToChordEvents(flat: readonly FlatChord[], tempoBpm: number): ChordEvent[] {
  const spb = 60 / tempoBpm;
  return flat.map((c) => {
    const parsed = parseChordSymbol(c.symbol);
    return {
      root: rootNameOf(c.symbol),
      quality: QUALITY_MAP[parsed.quality],
      time: c.startBeat * spb,
      duration: c.beats * spb,
    };
  });
}

/** FNV-1a 32-bit: stable take per progression content (same input → same band). */
export function deriveSeed(flat: readonly FlatChord[], style: BandStyle, tempoBpm: number): number {
  const text = `${style}|${tempoBpm}|${flat.map((c) => `${c.symbol}:${c.beats}`).join(",")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type JmoveStyle = "swing" | "ballad" | "bossa";

const STYLE_MAP: Record<JmoveStyle, JmoveStyle> = { swing: "swing", ballad: "ballad", bossa: "bossa" };

/** Per-style defaults mirroring jmove's Classic Swing / Soft Ballad / Bossa Nova presets. */
const STYLE_DEFAULTS: Record<JmoveStyle, Required<Omit<BandGenerateOptions, "seed">>> = {
  swing: { density: 50, swingAmount: 70, strumMs: 20, creativity: 30, conversation: 35, airGaps: 15, harmonicFreedom: 20, drumComplexity: 50, pianoComplexity: 50, bassComplexity: 50 },
  ballad: { density: 20, swingAmount: 40, strumMs: 0, creativity: 20, conversation: 25, airGaps: 35, harmonicFreedom: 20, drumComplexity: 50, pianoComplexity: 50, bassComplexity: 50 },
  bossa: { density: 50, swingAmount: 0, strumMs: 20, creativity: 15, conversation: 20, airGaps: 10, harmonicFreedom: 15, drumComplexity: 50, pianoComplexity: 50, bassComplexity: 50 },
};

/**
 * General MIDI note → our drum role. Toms (43/45/47/50) alias to the snare
 * voice until tom samples join the pack (documented in ADR-021); side-stick
 * (37) and pedal/open hats (44/46) alias to their family voice.
 */
export function gmToDrumRole(gm: number): DrumRole | null {
  if (gm === 35 || gm === 36) return "kick";
  if (gm === 37 || gm === 38 || gm === 40 || gm === 43 || gm === 45 || gm === 47 || gm === 50) return "snare";
  if (gm === 42 || gm === 44 || gm === 46) return "hat";
  if (gm === 51 || gm === 59) return "ride";
  if (gm === 53) return "ride-bell";
  if (gm === 49 || gm === 52 || gm === 55 || gm === 57) return "crash";
  return null;
}

const DRUM_MIDI: Record<DrumRole, number> = {
  kick: 36,
  snare: 38,
  hat: 42,
  ride: 51,
  "ride-bell": 53,
  crash: 49,
};

function clampVelocity(v: number): number {
  return Math.min(1, Math.max(0.05, v));
}

type JmoveModule = typeof import("@jmove/generator");

let libPromise: Promise<JmoveModule> | null = null;
function loadJmove(): Promise<JmoveModule> {
  if (!libPromise) libPromise = import("@jmove/generator");
  return libPromise;
}

/** Library version for UI labels (loaded lazily with the engine). */
export async function jmoveVersion(): Promise<string> {
  return (await loadJmove()).GENERATOR_VERSION;
}

export function createJmoveBandProvider(): BandPatternProvider {
  return {
    name: "jmove",
    async generateBand(
      flat: readonly FlatChord[],
      style: BandStyle,
      part: BandPart,
      tempoBpm: number,
      opts?: BandGenerateOptions,
    ): Promise<readonly BandEvent[]> {
      const jmoveStyle = (STYLE_MAP as Record<string, JmoveStyle>)[style];
      if (!jmoveStyle) throw new Error(`jmove: unsupported style ${style}`);
      if (!(tempoBpm > 0)) throw new Error("tempo must be positive");
      const totalBeats = flat.reduce((n, c) => n + c.beats, 0);
      if (totalBeats <= 0) return [];
      const spb = 60 / tempoBpm;
      const defaults = STYLE_DEFAULTS[jmoveStyle];
      const seed = opts?.seed ?? deriveSeed(flat, style, tempoBpm);
      const lib = await loadJmove();
      const result = lib.generateEnsemble({
        chordEvents: flatToChordEvents(flat, tempoBpm),
        style: jmoveStyle,
        tempo: tempoBpm,
        measures: Math.max(1, Math.round(totalBeats / 4)),
        density: opts?.density ?? defaults.density,
        swingAmount: opts?.swingAmount ?? defaults.swingAmount,
        strumMs: opts?.strumMs ?? defaults.strumMs,
        seed,
        creativity: opts?.creativity ?? defaults.creativity,
        conversation: opts?.conversation ?? defaults.conversation,
        airGaps: opts?.airGaps ?? defaults.airGaps,
        harmonicFreedom: opts?.harmonicFreedom ?? defaults.harmonicFreedom,
        drumGranular: lib.resolveDrumGranular(opts?.drumComplexity ?? defaults.drumComplexity),
        pianoGranular: lib.resolvePianoGranular(opts?.pianoComplexity ?? defaults.pianoComplexity),
        bassGranular: lib.resolveBassGranular(opts?.bassComplexity ?? defaults.bassComplexity),
      });
      const strumBeats = (opts?.strumMs ?? defaults.strumMs) / 1000 / spb;
      const out: BandEvent[] = [];
      if (part.bass) {
        for (const n of result.bass) {
          const t = n.time / spb;
          if (t < 0 || t >= totalBeats) continue;
          out.push({
            voice: "bass",
            timeBeats: t,
            durationBeats: Math.max(0.1, n.duration / spb),
            midi: Math.round(n.pitch),
            accent: n.velocity >= 100,
            velocity: clampVelocity(n.velocity / 127),
          });
        }
      }
      if (part.piano) {
        for (const n of result.piano) {
          const t = n.time / spb;
          if (t < 0 || t >= totalBeats) continue;
          const stagger = strumBeats > 0 && n.pitches.length >= 3 ? strumBeats : 0;
          n.pitches.forEach((p, i) => {
            out.push({
              voice: "piano",
              timeBeats: t + i * stagger,
              durationBeats: Math.max(0.1, n.duration / spb),
              midi: Math.round(p),
              accent: n.velocity >= 100,
              velocity: clampVelocity(n.velocity / 127),
            });
          });
        }
      }
      if (part.drums) {
        for (const h of result.drums) {
          const t = h.time / spb;
          if (t < 0 || t >= totalBeats) continue;
          const role = gmToDrumRole(Math.round(h.pitch));
          if (!role) continue;
          out.push({
            voice: "drums",
            timeBeats: t,
            durationBeats: 0.25,
            drum: role,
            midi: DRUM_MIDI[role],
            accent: h.velocity >= 100,
            velocity: clampVelocity(h.velocity / 127),
          });
        }
      }
      out.sort((a, b) => a.timeBeats - b.timeBeats || a.voice.localeCompare(b.voice));
      return out;
    },
  };
}
