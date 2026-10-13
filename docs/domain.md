# Domain glossary + data model

- **Degree**: scale degree / interval relative to a chord root + accidental +
  octave offset. Round-trips degree→pitch→degree across all 12 keys (M1).
- **Enharmonic spelling**: transpose with correct spelling (Eb°7, not D#°7).
- **Harmonic context**: `{ chords: [{symbol, beats}], originalKey, function }`
  where function ∈ `ii-V-I major`, `ii-V-i minor`, `dom7 (bII7)`, `turnaround`, …
- **Guide tone**: 3rd/7th of each chord; overlay highlights lick landings (M3).
- **Lick**: `{ id, title, pattern: [{degree, accidental, octaveOffset, startBeat,
  durationBeats}], harmonicContext, source {artist, instrument, track, album,
  year, recordingUrl, timestamp, solo/chorus/bar}, tags, difficulty, notes,
  practiceLog, ownerId, createdAt, updatedAt, deletedAt, schemaVersion }`
- **Song**: `{ title, composer, key, form: sections → bars → [{chord, beats}],
  externalUrl (e.g. realbook.site score page), origin: typed|musicxml|ireal|
  bundled-example, ownerId, createdAt, updatedAt, deletedAt }`
- Only chord changes + metadata sync to D1. Imported scores/MusicXML melodies
  (possibly copyrighted) and audio stay in the browser, never uploaded.

Full entities + matching rules land in M1–M3; M0 has `hello.ts` proving the layer.
