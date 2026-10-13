// domain/song: minimal Song entity (chord changes + metadata). Melodies and
// imported scores are never modeled here — only changes sync to the cloud.
// Full importers (MusicXML/iReal/typed) land in M2; M1 needs the shape + validation.

import { parseChordSymbol } from "./chords.js";

export const SONG_SCHEMA_VERSION = 1;

export type SongOrigin = "typed" | "musicxml" | "ireal" | "bundled-example";

export interface SongBar {
  readonly chord: string;
  readonly beats: number;
}

export interface SongSection {
  readonly name: string;
  readonly bars: readonly SongBar[];
}

export interface Song {
  readonly id: string;
  readonly title: string;
  readonly composer: string;
  readonly key: string;
  readonly form: readonly SongSection[];
  readonly externalUrl: string;
  readonly origin: SongOrigin;
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly schemaVersion: number;
}

export class SongValidationError extends Error {
  readonly code = "invalid_song";
}

function fail(msg: string): never {
  throw new SongValidationError(msg);
}

/** Parse "Dm7 G7 | Cmaj7 |" into bars (chords carry beats=4 by default). */
export function parseTypedBars(input: string, beatsPerChord = 4): SongBar[] {
  const bars: SongBar[] = [];
  for (const part of input.split("|")) {
    const symbols = part.trim().split(/\s+/).filter(Boolean);
    if (symbols.length === 0) continue;
    const beats = beatsPerChord / symbols.length;
    for (const symbol of symbols) {
      try {
        parseChordSymbol(symbol);
      } catch {
        fail(`unparseable chord: ${symbol}`);
      }
      bars.push({ chord: symbol, beats });
    }
  }
  if (bars.length === 0) fail("no bars found");
  if (bars.length > 512) fail("too many bars (max 512)");
  return bars;
}

/** Total beats across all sections. */
export function songBeats(song: Song): number {
  return song.form.reduce((n, s) => n + s.bars.reduce((m, b) => m + b.beats, 0), 0);
}
