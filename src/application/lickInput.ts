// application/lickInput: create-a-lick-from-ABC use case. The parse +
// validate + assemble pipeline is business logic and lives here (on top of
// the domain); components only collect raw fields and surface errors.

import { abcToPattern, parseAbcNotes } from "../domain/abc.js";
import { parseChordSymbol } from "../domain/chords.js";
import type { Lick, LickFunction } from "../domain/lick.js";
import { saveLick, type SaveLickDeps, type SaveLickInput } from "./licks.js";

export interface AbcLickInput {
  readonly title: string;
  readonly abc: string;
  readonly chord: string;
  readonly originalKey: string;
  readonly function: LickFunction;
  readonly artist: string;
  readonly tags: readonly string[];
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly beatsPerChord?: number;
}

export class LickInputError extends Error {
  readonly code = "invalid_lick_input";
}

export async function createLickFromAbc(deps: SaveLickDeps, ownerId: string, input: AbcLickInput): Promise<Lick> {
  return saveLick(deps, ownerId, abcToSaveInput(input));
}

/** Pure ABC -> SaveLickInput transform; throws LickInputError with a user-safe message. */
export function abcToSaveInput(input: AbcLickInput): SaveLickInput {
  let root;
  try {
    root = parseChordSymbol(input.chord.trim()).root;
  } catch {
    throw new LickInputError(`Chord not understood: “${input.chord.trim()}”`);
  }
  let notes;
  try {
    notes = parseAbcNotes(input.abc);
  } catch (e) {
    throw new LickInputError(e instanceof Error ? `ABC: ${e.message}` : "ABC: could not parse");
  }
  const { pattern } = abcToPattern(notes, root);
  if (pattern.length === 0) throw new LickInputError("ABC has no notes (only rests?)");
  return {
    title: input.title,
    pattern,
    harmonicContext: {
      chords: [{ symbol: input.chord.trim(), beats: input.beatsPerChord ?? 4 }],
      originalKey: input.originalKey.trim(),
      function: input.function,
    },
    source: { artist: input.artist.trim(), instrument: "" },
    tags: input.tags.flatMap((t) => t.split(",")).map((t) => t.trim()).filter(Boolean),
    difficulty: input.difficulty,
    notes: "",
  };
}
