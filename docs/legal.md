# Legal

- **Code licence**: all original LickLab code is GPL-3.0-or-later (`LICENSE`,
  ADR-009). Compatible deps only: MIT, Apache-2.0, LGPL-3.0-or-later (Verovio —
  combined work stays GPL; keep the LGPL linking disclosure), CC0 / CC BY 3.0
  sample data. **Forbidden**: GPL-2.0-only code (incompatible with GPL-3.0) —
  this rules out RubberBand for time-stretch; M5 must use SoundTouch (LGPL) or
  a non-copyleft engine.
- **Samples**: VSCO 2 CE (CC0, incl. double bass), Virtuosity Drums (CC0),
  Salamander Grand (CC BY 3.0 — attribution page required). Ship curated
  subsets only. Verovio LGPL-3.0-or-later (linking disclosure). Time-stretch:
  SoundTouch (LGPL) or non-copyleft only — RubberBand is GPL-2.0-only and
  incompatible with GPL-3.0 (see ADR-009).
- **Weimar Jazz DB (ODbL)**: bulk import = Derivative Database → share-alike +
  attribution if publicly used. Prefer hand-transcribed inspired licks; any bulk
  seeding needs ODbL compliance.
- **Cloud storage**: D1 holds user licks (pattern + harmonic context +
  metadata), chord changes and loop markers. Imported scores / MusicXML
  melodies (possibly copyrighted) and ALL audio stay local, never uploaded —
  so the cloud never redistributes copyrighted scores or recordings.
- **Privacy/GDPR**: minimum account data, in-app export + deletion, no third-party
  trackers. Privacy policy + terms ship in-app (M4).

## README legal reasoning (summary)

Lead sheets are copyrighted; LickLab stores only user-typed/imported chord
changes + metadata it has the right to hold, links out to licensed sources,
and keeps melodies/audio local — so the cloud never redistributes copyrighted
scores or recordings.
