// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// scripts/make-starter-pack.mjs — builds public/starter-pack.json from
// self-written licks through parseLick (validation + derived signatures are
// guaranteed by the domain, not hand-tuned). Run: node scripts/make-starter-pack.mjs
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { parseLick } = await import(pathToFileURL("./src/domain/lick.ts").href);

const SRC = {
  artist: "LickLab (self-written example)",
  instrument: "bass",
  track: "",
  album: "",
  year: null,
  recordingUrl: "",
  timestampSeconds: null,
  location: "",
};

const n = (steps, semitones, startBeat, durationBeats = 0.5, octaveOffset = 0) => ({
  steps,
  semitones,
  octaveOffset,
  startBeat,
  durationBeats,
});

const inputs = [
  {
    id: "starter-01",
    title: "Chord-Tone Descent",
    pattern: [
      n(4, 7, 0, 1), n(2, 3, 1, 1), n(0, 0, 2, 1), n(0, 0, 3, 1, -1),
      n(5, 9, 4, 1), n(3, 5, 5, 1), n(0, 0, 6, 1), n(2, 3, 7, 1),
      n(1, 2, 8, 1), n(3, 5, 9, 1), n(5, 9, 10, 1), n(6, 10, 11, 1),
    ],
    harmonicContext: {
      chords: [
        { symbol: "Dm7", beats: 4 },
        { symbol: "G7", beats: 4 },
        { symbol: "Cmaj7", beats: 4 },
      ],
      originalKey: "C",
      function: "ii-V-I major",
    },
    tags: ["arpeggio", "chord tones", "ii-V-I"],
    difficulty: 1,
    notes: "Descending arpeggios through the ii-V-I. Start here: every note is a chord tone.",
  },
  {
    id: "starter-02",
    title: "ii-V Enclosure",
    pattern: [
      n(0, 0, 0), n(2, 3, 0.5), n(4, 7, 1), n(6, 10, 1.5), n(0, 0, 2),
      n(6, 11, 3), n(1, 2, 3.5), n(0, 0, 4, 1), n(2, 3, 5, 1), n(4, 7, 6, 1), n(1, 2, 7, 2),
    ],
    harmonicContext: {
      chords: [
        { symbol: "Dm7", beats: 4 },
        { symbol: "G7", beats: 4 },
        { symbol: "Cmaj7", beats: 4 },
      ],
      originalKey: "C",
      function: "ii-V-I major",
    },
    tags: ["enclosure", "bebop", "ii-V-I"],
    difficulty: 3,
    notes: "Eighth run up the Dm7 arpeggio, C#–E enclosure around D over the G7, lands on the E (3rd of C).",
  },
  {
    id: "starter-03",
    title: "Minor ii-V Diminished Excursion",
    pattern: [
      n(0, 0, 0), n(2, 3, 0.5), n(4, 6, 1), n(6, 10, 1.5), n(0, 0, 2),
      n(5, 9, 4), n(6, 11, 4.5), n(5, 9, 5), n(3, 5, 8, 1), n(1, 1, 9, 1), n(3, 5, 10, 2),
    ],
    harmonicContext: {
      chords: [
        { symbol: "Dm7b5", beats: 4 },
        { symbol: "G7", beats: 4 },
        { symbol: "Cm7", beats: 4 },
      ],
      originalKey: "C",
      function: "ii-V-i minor",
    },
    tags: ["minor", "diminished", "ii-V-i"],
    difficulty: 3,
    notes: "D fully-diminished run over the m7b5, chromatic turn B–C#–B over the alt V, Cm7 arpeggio home.",
  },
  {
    id: "starter-04",
    title: "Blues Bounce",
    pattern: [n(0, 0, 0), n(1, 2, 0.5), n(2, 4, 1), n(4, 7, 1.5), n(5, 9, 2), n(4, 7, 2.5), n(2, 4, 3), n(1, 2, 3.5)],
    harmonicContext: { chords: [{ symbol: "C7", beats: 4 }], originalKey: "C", function: "blues" },
    tags: ["blues", "pentatonic", "single chord"],
    difficulty: 1,
    notes: "Pentatonic bounce over a blues C7. Works on any dominant chord.",
  },
  {
    id: "starter-05",
    title: "Turnaround Rider",
    pattern: [n(0, 0, 0), n(2, 4, 1), n(5, 9, 2), n(0, 0, 3, 1, -1), n(1, 2, 4), n(3, 5, 5), n(4, 7, 6), n(6, 10, 7)],
    harmonicContext: {
      chords: [
        { symbol: "Cmaj7", beats: 2 },
        { symbol: "Am7", beats: 2 },
        { symbol: "Dm7", beats: 2 },
        { symbol: "G7", beats: 2 },
      ],
      originalKey: "C",
      function: "turnaround",
    },
    tags: ["turnaround", "rhythm changes"],
    difficulty: 2,
    notes: "One chord tone per half bar, Bb on the G7 sets up the next chorus.",
  },
  {
    id: "starter-06",
    title: "Pentatonic Flip",
    pattern: [n(0, 0, 0), n(2, 3, 0.5), n(3, 5, 1), n(4, 7, 1.5), n(6, 10, 2), n(7, 12, 2.5), n(6, 10, 3), n(4, 7, 3.5)],
    harmonicContext: { chords: [{ symbol: "Am7", beats: 4 }], originalKey: "A", function: "static minor" },
    tags: ["pentatonic", "minor", "single chord"],
    difficulty: 2,
    notes: "A minor pentatonic up to the octave and back — fits any four beats of a minor chord.",
  },
  {
    id: "starter-07",
    title: "Major Land",
    pattern: [n(0, 0, 0), n(2, 4, 0.5), n(4, 7, 1), n(6, 11, 1.5), n(7, 12, 2, 1)],
    harmonicContext: { chords: [{ symbol: "Cmaj7", beats: 4 }], originalKey: "C", function: "static major" },
    tags: ["arpeggio", "major", "single chord"],
    difficulty: 1,
    notes: "Cmaj7 up to the octave. The simplest major-7 statement.",
  },
  {
    id: "starter-08",
    title: "Guide-Tone Glide",
    pattern: [n(2, 4, 0, 2), n(6, 11, 2, 2), n(0, 0, 4, 2), n(4, 7, 6, 2)],
    harmonicContext: {
      chords: [
        { symbol: "Cmaj7", beats: 4 },
        { symbol: "Am7", beats: 4 },
      ],
      originalKey: "C",
      function: "static major",
    },
    tags: ["guide tones", "ballad"],
    difficulty: 2,
    notes: "3rd then 7th of Cmaj7 sliding into root and 5th of Am7. Half-note motion for ballads.",
  },
];

const licks = inputs.map((input) =>
  parseLick({
    ...input,
    source: SRC,
    visibility: "public",
    license: "CC BY 4.0",
    ownerId: "starter-pack",
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
    deletedAt: null,
    schemaVersion: 2,
  }),
);

const out = { schemaVersion: 2, kind: "licklab-starter-pack", licks };
writeFileSync("public/starter-pack.json", JSON.stringify(out, null, 2) + "\n");
console.log(`starter-pack.json: ${licks.length} licks`);
for (const l of licks) console.log(` ${l.id.padEnd(11)} ${l.functionKey.padEnd(14)} ${l.contextKey.slice(0, 40)}`);
