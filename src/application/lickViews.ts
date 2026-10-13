// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/lickViews: view-model builder for transposition displays.
// Which semitone shift represents Bb/Eb instruments and how the bass view is
// range-fit is domain semantics — components must not compute it themselves.

import { soundingToAbc } from "../domain/abc.js";
import { guideToneDegrees, parseChordSymbol } from "../domain/chords.js";
import type { Lick } from "../domain/lick.js";
import { spellDegree } from "../domain/pitch.js";
import { pitchName } from "../domain/pitch.js";
import { fitBassRange, transposeChordSymbol, transposeLick, transposeRoot } from "../domain/transpose.js";

export const LICK_VIEW_KINDS = ["concert", "Bb", "Eb", "bass"] as const;
export type LickViewKind = (typeof LICK_VIEW_KINDS)[number];

export interface LickView {
  readonly kind: LickViewKind;
  /** ABC ready for the NotationRenderer. */
  readonly abc: string;
  /** Chord line for display (transposed, with concert reference when shifted). */
  readonly chordLabel: string;
}

/**
 * Guide-tone reference for the lick's own chords: spelled 3rd+7th of each
 * chord in the declared context (overlay cue for practice, M3 spec).
 */
export function buildGuideTones(lick: Lick): string {
  return lick.harmonicContext.chords
    .map((c) => {
      const parsed = parseChordSymbol(c.symbol);
      const { third, seventh } = guideToneDegrees(parsed);
      const names = [third, seventh]
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .map((t) => pitchName(spellDegree({ ...parsed.root, octave: 4 }, { steps: t.steps, semitones: t.semitones })));
      return names.length ? `${parsed.symbol}: ${names.join(" · ")}` : parsed.symbol;
    })
    .join("  |  ");
}

const SHIFT: Record<LickViewKind, number> = { concert: 0, Bb: 2, Eb: 9, bass: 0 };
const CLEF: Record<LickViewKind, "treble" | "bass"> = { concert: "treble", Bb: "treble", Eb: "treble", bass: "bass" };

export function buildLickViews(lick: Lick): Record<LickViewKind, LickView> {
  const out = {} as Record<LickViewKind, LickView>;
  for (const kind of LICK_VIEW_KINDS) out[kind] = buildLickView(lick, kind);
  return out;
}

export function buildLickView(lick: Lick, kind: LickViewKind): LickView {
  const shift = SHIFT[kind];
  const firstSymbol = lick.harmonicContext.chords[0]?.symbol ?? "C";
  const root = transposeRoot(parseChordSymbol(firstSymbol).root, shift);
  let notes = transposeLick(lick, root);
  if (kind === "bass") notes = fitBassRange(notes);
  const abc = soundingToAbc(notes, { title: lick.title, clef: CLEF[kind] });
  const concert = lick.harmonicContext.chords.map((c) => c.symbol).join(" → ");
  const chordLabel = shift === 0 ? concert : `${lick.harmonicContext.chords.map((c) => transposeChordSymbol(c.symbol, shift)).join(" → ")} (concert ${concert})`;
  return { kind, abc, chordLabel };
}
