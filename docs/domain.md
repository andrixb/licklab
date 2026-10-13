# Domain glossary + data model

- **Degree**: diatonic steps + semitones above a chord root (canonical:
  semitones 0..11, octaves carried by steps). Round-trips degree→pitch→degree
  across all 12 keys; transposition preserves semitone shape everywhere.
- **Enharmonic spelling**: derived from scale degrees, never pc lookup —
  Eb°7 spells Eb Gb Bbb Dbb (not D#°7); Db+2 → Eb (not D#); C+2 → D (not Cx).
- **Chord symbol**: root (spelling kept) + core quality (maj7/maj6/min7/min6/
  minmaj7/dom7/dim7/hdim7/aug/sus7/power5). Tension suffixes (9/13/#11/…)
  fall back to the core quality; the full symbol string is preserved.
- **Harmonic context**: `{ chords: [{symbol, beats}], originalKey, function }`
  where function ∈ `ii-V-I major`, `ii-V-i minor`, `dom7`, `turnaround`,
  `static major`, `static minor`, `blues`, `other`.
- **Guide tone**: 3rd (4th for sus; none for power chords) + 7th degrees;
  overlay highlights lick landings (M3).
- **Lick**: `{ id, title, pattern: [{steps, semitones, octaveOffset, startBeat,
  durationBeats}] (monophonic, canonical degrees), harmonicContext, source
  {artist, instrument, track, album, year, recordingUrl, timestampSeconds,
  location}, tags, difficulty 1-5, notes, ownerId, createdAt, updatedAt,
  deletedAt (soft-delete tombstone), schemaVersion: 1 }`.
- **Song** (minimal in M1; importers in M2): `{ title, composer, key, form:
  sections → bars → [{chord, beats}], externalUrl (e.g. realbook.site score
  page), origin: typed|musicxml|ireal|bundled-example, ownerId, timestamps,
  deletedAt, schemaVersion: 1 }`. Typed entry `"Dm7 G7 | Cmaj7 |"` supported.
- **ABC interchange** (entry + notation): monophonic subset — headers X:/L:/K:,
  notes A-G/a-g with ^ _ = accidentals, `'`/`,` octave marks, lengths
  (2, /2, 3/2), rests `z`, bar lines. No ties/chords/tuplets/decorations.
  Generated ABC uses explicit accidentals + `K:C clef=…` (no key-signature
  dependence). Transpose views: concert / Bb (+2 semis) / Eb (+9) / bass clef
  (auto range-fit).
- Only chord changes + metadata sync to D1. Imported scores/MusicXML melodies
  (possibly copyrighted) and audio stay in the browser, never uploaded.
