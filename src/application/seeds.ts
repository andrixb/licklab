// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/seeds: self-written example licks (no copyrighted material).
// Seeded into a fresh local namespace so the library isn't empty on first run.

import type { SaveLickInput } from "./licks.js";

export const SEED_LICKS: readonly SaveLickInput[] = [
  {
    title: "Walkdown to Five (example)",
    // Descending chromatic walkdown: D4 C#4 B3 Bb3 A3 over Dm7 → G7.
    // Degrees are signed: `semitones` may be negative (down a semitone from
    // the root); `steps` carries the descent below the root letter.
    pattern: [
      { steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 },
      { steps: -1, semitones: -1, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
      { steps: -2, semitones: -3, octaveOffset: 0, startBeat: 2, durationBeats: 1 },
      { steps: -2, semitones: -4, octaveOffset: 0, startBeat: 3, durationBeats: 1 },
      { steps: -3, semitones: -5, octaveOffset: 0, startBeat: 4, durationBeats: 2 },
    ],
    harmonicContext: {
      chords: [
        { symbol: "Dm7", beats: 4 },
        { symbol: "G7", beats: 4 },
      ],
      originalKey: "C",
      function: "ii-V-I major",
    },
    source: { artist: "LickLab (self-written example)", instrument: "bass" },
    tags: ["walkdown", "ii-V"],
    difficulty: 2,
    notes: "Diatonic walkdown into the V. Self-written example.",
  },
  {
    title: "Blues Turnaround Tag (example)",
    pattern: [
      { steps: 2, semitones: 4, octaveOffset: 0, startBeat: 0, durationBeats: 1 },
      { steps: 4, semitones: 7, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
      { steps: 5, semitones: 9, octaveOffset: 0, startBeat: 2, durationBeats: 1 },
      { steps: 6, semitones: 10, octaveOffset: 0, startBeat: 3, durationBeats: 1 },
    ],
    harmonicContext: {
      chords: [{ symbol: "C7", beats: 4 }],
      originalKey: "C",
      function: "dom7",
    },
    source: { artist: "LickLab (self-written example)", instrument: "bass" },
    tags: ["blues", "turnaround"],
    difficulty: 1,
    notes: "3-5-6-b7 tag over a dominant chord. Self-written example.",
  },
];
