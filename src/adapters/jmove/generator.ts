// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/jmove/generator: BandPatternProvider using @jmove/generator
// (MIT licensed). This replaces our basic pattern generation with professional-
// quality backing tracks.

import type { BandPatternProvider, BandGenerateOptions } from "../../application/ports.js";
import type { BandEvent, BandPart, BandStyle, Voice, DrumRole } from "../../domain/band.js";
import type { FlatChord } from "../../domain/progression.js";
import type { ChordEvent, BassNote, CompNote, DrumHit, PracticeStyle } from "@jmove/generator";
import {
  generateEnsemble,
  resolveBassGranular,
  resolveDrumGranular,
  resolvePianoGranular,
  GM_DRUMS,
} from "@jmove/generator";
import { parseChordSymbol } from "../../domain/chords.js";
import { LETTERS, pitchClassOf, pitchName, type SpelledPitch } from "../../domain/pitch.js";

/** Convert our BandStyle to JMove's PracticeStyle */
function toJmoveStyle(style: BandStyle): PracticeStyle {
  switch (style) {
    case "swing":
      return "swing";
    case "bossa":
      return "bossa";
    case "ballad":
      return "ballad";
    case "straight":
      return "fusion"; // JMove doesn't have "straight", use fusion as closest
  }
}

/** Convert our FlatChord[] to JMove's ChordEvent[] (thin pass-through).
 *
 * No musical logic lives here: the root boundary is lexical, the quality
 * string comes from domain/chords.ts already in JMove-canonical form
 * (extensions and alterations preserved verbatim — "Bb13" stays "13",
 * "Bb7#9" stays "7#9", never simplified to "7"), and JMove itself
 * interprets it. Slash bass is parsed by domain/chords.ts but NOT sent:
 * ChordEvent has no bass field and JMove's normalize() strips "/X", so
 * the bass follows the chord root — identical to JMove's own demo,
 * which builds the same ChordEvent shape (see ADR-023).
 *
 * Exported pure (no Tone, no network) so parity tests can assert the
 * exact ChordEvents LickLab hands JMove.
 */
export function toChordEvents(flat: readonly FlatChord[], tempoBpm: number): ChordEvent[] {
  const beatsPerSecond = tempoBpm / 60;

  return flat.map((chord) => {
    const parsed = parseChordSymbol(chord.symbol);
    return {
      root: jmoveRootName(parsed.root),
      quality: parsed.jmoveQuality,
      time: chord.startBeat / beatsPerSecond,
      duration: chord.beats / beatsPerSecond,
    };
  });
}

/**
 * Root spelling JMove's own reader handles (single b/# ASCII, uppercase
 * letter — probed: lowercase, unicode ♭, and double accidentals misread
 * as other pitches). Single-accidental spellings pass through untouched
 * (F# stays F#: JMove reads sharps and flats identically). Double
 * accidentals (bb/x) are respelled to the single-accidental enharmonic
 * with the fewest accidentals (natural > flat > sharp, then letter
 * order) — a mechanical transliteration into JMove's expected input,
 * this adapter's only job. Deterministic; see ADR-023.
 */
export function jmoveRootName(root: SpelledPitch): string {
  if (root.accidental === -1 || root.accidental === 0 || root.accidental === 1) {
    return pitchName(root);
  }
  const pc = pitchClassOf(root);
  const naturals: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const cands: { name: string; rank: number }[] = [];
  for (const letter of LETTERS) {
    const natural = naturals[letter] as number;
    for (const acc of [0, -1, 1] as const) {
      if ((((natural + acc) % 12) + 12) % 12 === pc) {
        const name = `${letter}${acc === -1 ? "b" : acc === 1 ? "#" : ""}`;
        cands.push({ name, rank: acc === 0 ? 0 : acc === -1 ? 1 : 2 });
      }
    }
  }
  cands.sort((a, b) => a.rank - b.rank || (a.name < b.name ? -1 : 1));
  const best = cands[0];
  if (!best) throw new Error(`unspellable root pitch class: ${pc}`);
  return best.name;
}

/** Convert JMove's BassNote[] to our BandEvent[] */
function bassNotesToEvents(notes: BassNote[], tempoBpm: number): BandEvent[] {
  const beatsPerSecond = tempoBpm / 60;
  
  return notes.map((note) => ({
    voice: "bass" as Voice,
    timeBeats: note.time * beatsPerSecond,
    durationBeats: note.duration * beatsPerSecond,
    midi: note.pitch,
    velocity: note.velocity / 127, // Convert 0-127 to 0-1
  }));
}

/** Convert JMove's CompNote[] to our BandEvent[] */
function compNotesToEvents(notes: CompNote[], tempoBpm: number): BandEvent[] {
  const beatsPerSecond = tempoBpm / 60;
  
  // Each CompNote has multiple pitches (a chord), so we expand them
  const events: BandEvent[] = [];
  for (const note of notes) {
    for (const pitch of note.pitches) {
      events.push({
        voice: "piano" as Voice,
        timeBeats: note.time * beatsPerSecond,
        durationBeats: note.duration * beatsPerSecond,
        midi: pitch,
        velocity: note.velocity / 127,
      });
    }
  }
  
  return events;
}

/** Convert JMove's DrumHit[] to our BandEvent[] */
function drumHitsToEvents(hits: DrumHit[], tempoBpm: number): BandEvent[] {
  const beatsPerSecond = tempoBpm / 60;
  
  // Map GM drum pitches to our DrumRole
  const gmToRole = (pitch: number): DrumRole | undefined => {
    if (pitch === GM_DRUMS.KICK) return "kick";
    if (pitch === GM_DRUMS.SNARE || pitch === GM_DRUMS.SNARE_GHOST) return "snare";
    if (pitch === GM_DRUMS.HI_HAT_CLOSED || pitch === GM_DRUMS.HI_HAT_OPEN || pitch === GM_DRUMS.HI_HAT_PEDAL) return "hat";
    if (pitch === GM_DRUMS.RIDE) return "ride";
    if (pitch === GM_DRUMS.RIDE_BELL) return "ride-bell";
    if (pitch === GM_DRUMS.CRASH) return "crash";
    return undefined;
  };
  
  const events: BandEvent[] = [];
  for (const hit of hits) {
    const role = gmToRole(hit.pitch);
    if (!role) continue; // Skip unmapped drums
    
    events.push({
      voice: "drums" as Voice,
      timeBeats: hit.time * beatsPerSecond,
      durationBeats: hit.duration * beatsPerSecond,
      drum: role,
      midi: hit.pitch,
      velocity: hit.velocity / 127,
      accent: hit.velocity > 100,
    });
  }
  
  return events;
}

export function createJmoveBandProvider(): BandPatternProvider {
  return {
    name: "jmove-generator",

    async generateBand(
      flat: readonly FlatChord[],
      style: BandStyle,
      part: BandPart,
      tempoBpm: number,
      opts?: BandGenerateOptions,
    ): Promise<readonly BandEvent[]> {
      const chordEvents = toChordEvents(flat, tempoBpm);
      const jmoveStyle = toJmoveStyle(style);
      const totalBeats = flat.reduce((n, c) => n + c.beats, 0);
      const measures = Math.max(1, Math.ceil(totalBeats / 4)); // Assume 4/4 time
      const measureDuration = (4 * 60) / tempoBpm;

      // Coordinated ensemble (same call the demo's Jam Session UI makes):
      // drums inform bass timing, bass register guides piano voicings.
      // All Feel/Musicality/Complexity sliders map to ensemble parameters so
      // every control alters the generated take (seeded when a seed is given).
      const result = generateEnsemble({
        chordEvents,
        style: jmoveStyle,
        tempo: tempoBpm,
        timeSignature: [4, 4],
        measures,
        measureInfo: { totalMeasures: measures, measureDuration },
        instrumentStyles: { bass: jmoveStyle, piano: jmoveStyle, drums: jmoveStyle },
        ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
        ...(opts?.density !== undefined ? { density: opts.density } : {}),
        ...(opts?.swingAmount !== undefined ? { swingAmount: opts.swingAmount } : {}),
        ...(opts?.strumMs !== undefined ? { strumMs: opts.strumMs } : {}),
        ...(opts?.creativity !== undefined ? { creativity: opts.creativity } : {}),
        ...(opts?.conversation !== undefined ? { conversation: opts.conversation } : {}),
        ...(opts?.airGaps !== undefined ? { airGaps: opts.airGaps } : {}),
        ...(opts?.harmonicFreedom !== undefined ? { harmonicFreedom: opts.harmonicFreedom } : {}),
        ...(opts?.drumComplexity !== undefined ? { drumGranular: resolveDrumGranular(opts.drumComplexity) } : {}),
        ...(opts?.pianoComplexity !== undefined ? { pianoGranular: resolvePianoGranular(opts.pianoComplexity) } : {}),
        ...(opts?.bassComplexity !== undefined ? { bassGranular: resolveBassGranular(opts.bassComplexity) } : {}),
      });

      const events: BandEvent[] = [];
      if (part.bass) events.push(...bassNotesToEvents(result.bass, tempoBpm));
      if (part.piano) events.push(...compNotesToEvents(result.piano, tempoBpm));
      if (part.drums) events.push(...drumHitsToEvents(result.drums, tempoBpm));

      // Sort by time
      events.sort((a, b) => a.timeBeats - b.timeBeats);

      return events;
    },
  };
}

/** Get the version of @jmove/generator */
export async function jmoveVersion(): Promise<string> {
  return "1.5.1";
}
