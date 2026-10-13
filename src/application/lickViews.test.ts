// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { buildLickView, buildLickViews, LICK_VIEW_KINDS } from "./lickViews.js";
import { parseChordSymbol } from "../domain/chords.js";
import type { Lick } from "../domain/lick.js";
import { parseLick } from "../domain/lick.js";
import { midiOf, parsePitchName, pitchName } from "../domain/pitch.js";

const lick: Lick = parseLick({
  id: "l1",
  title: "Test",
  pattern: [
    { steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 },
    { steps: 2, semitones: 3, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
    { steps: 4, semitones: 7, octaveOffset: 0, startBeat: 2, durationBeats: 2 },
  ],
  harmonicContext: { chords: [{ symbol: "Dm7", beats: 4 }], originalKey: "C", function: "ii-V-I major" },
  source: { artist: "", instrument: "", track: "", album: "", year: null, recordingUrl: "", timestampSeconds: null, location: "" },
  tags: [],
  difficulty: 2,
  notes: "",
  ownerId: "u1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  schemaVersion: 1,
});

/** First sounding pitch embedded in a generated ABC line (explicit accidental + note). */
function firstPitchOf(abc: string): number {
  const token = /^[\^_=]*[A-Ga-g][,']*/.exec(abc.split("\n").at(-1) ?? "")?.[0] ?? "";
  const acc = token.startsWith("^") ? 1 : token.startsWith("_") ? -1 : 0;
  const letter = /[A-Ga-g]/.exec(token)?.[0] ?? "C";
  const marks = (token.match(/'/g) ?? []).length - (token.match(/,/g) ?? []).length;
  const octave = (letter === letter.toLowerCase() ? 5 : 4) + marks;
  return midiOf(parsePitchName(`${letter}${acc === 1 ? "#" : acc === -1 ? "b" : ""}`, octave));
}

describe("buildLickViews", () => {
  it("covers all kinds", () => {
    const views = buildLickViews(lick);
    expect(Object.keys(views)).toEqual([...LICK_VIEW_KINDS]);
  });
  it("concert keeps the original root and chords", () => {
    const v = buildLickView(lick, "concert");
    expect(v.chordLabel).toBe("Dm7");
    expect(pitchName(parseChordSymbol("Dm7").root)).toBe("D");
    expect(v.abc).toContain("Dm7".length && "T"); // title line present
    expect(v.abc).toContain("clef=treble");
  });
  it("Bb view is +2 semitones; Eb view is +9; label names both", () => {
    expect(firstPitchOf(buildLickView(lick, "Bb").abc)).toBe(firstPitchOf(buildLickView(lick, "concert").abc) + 2);
    expect(firstPitchOf(buildLickView(lick, "Eb").abc)).toBe(firstPitchOf(buildLickView(lick, "concert").abc) + 9);
    expect(buildLickView(lick, "Bb").chordLabel).toBe("Em7 (concert Dm7)");
  });
  it("bass view uses bass clef and fits below concert register", () => {
    const v = buildLickView(lick, "bass");
    expect(v.abc).toContain("clef=bass");
    expect(firstPitchOf(v.abc)).toBeLessThan(firstPitchOf(buildLickView(lick, "concert").abc));
  });
});
