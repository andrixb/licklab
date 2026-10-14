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
  generateWalkingBass,
  generatePianoComping,
  generateDrumPattern,
  GM_DRUMS,
} from "@jmove/generator";
import { parseChordSymbol } from "../../domain/chords.js";
import { pitchName } from "../../domain/pitch.js";

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

/** Convert our FlatChord[] to JMove's ChordEvent[] */
function toChordEvents(flat: readonly FlatChord[], tempoBpm: number): ChordEvent[] {
  const beatsPerSecond = tempoBpm / 60;
  
  return flat.map((chord) => {
    const parsed = parseChordSymbol(chord.symbol);
    const root = pitchName(parsed.root);
    const quality = parsed.quality;
    
    // Convert our quality names to JMove's format
    let jmoveQuality: string;
    switch (quality) {
      case "maj7":
        jmoveQuality = "maj7";
        break;
      case "min7":
        jmoveQuality = "m7";
        break;
      case "dom7":
        jmoveQuality = "7";
        break;
      case "dim7":
        jmoveQuality = "dim7";
        break;
      case "hdim7":
        jmoveQuality = "m7b5";
        break;
      case "minmaj7":
        jmoveQuality = "mMaj7";
        break;
      case "sus7":
        jmoveQuality = "sus7";
        break;
      default:
        jmoveQuality = quality;
    }
    
    return {
      root,
      quality: jmoveQuality,
      time: chord.startBeat / beatsPerSecond,
      duration: chord.beats / beatsPerSecond,
    };
  });
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _opts?: BandGenerateOptions,
    ): Promise<readonly BandEvent[]> {
      const chordEvents = toChordEvents(flat, tempoBpm);
      const jmoveStyle = toJmoveStyle(style);
      const totalBeats = flat.reduce((n, c) => n + c.beats, 0);
      const measures = Math.ceil(totalBeats / 4); // Assume 4/4 time
      
      const events: BandEvent[] = [];
      
      // Generate bass if enabled
      if (part.bass) {
        const bassNotes = generateWalkingBass(chordEvents, {
          style: jmoveStyle,
          tempo: tempoBpm,
          humanize: true,
        });
        events.push(...bassNotesToEvents(bassNotes, tempoBpm));
      }
      
      // Generate piano if enabled
      if (part.piano) {
        const compNotes = generatePianoComping(chordEvents, {
          style: jmoveStyle,
          tempo: tempoBpm,
          humanize: true,
        });
        events.push(...compNotesToEvents(compNotes, tempoBpm));
      }
      
      // Generate drums if enabled
      if (part.drums) {
        const drumHits = generateDrumPattern({
          style: jmoveStyle,
          tempo: tempoBpm,
          measures,
          humanize: true,
        });
        events.push(...drumHitsToEvents(drumHits, tempoBpm));
      }
      
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
