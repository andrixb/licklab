# Roadmap

- [x] **M0** — skeleton, tooling, CI, hello-world + Worker + D1, AGENTS.md + docs.
- [x] **M1** — domain model (pitch/enharmonics, chords, degrees, Lick/Song) + Dexie local storage + Verovio notation + ABC entry + C/Bb/Eb/bass views + PWA shell.
- [x] **Phase 0** — audit of existing build + community-database replan → `docs/existing-implementation.md`.
- [x] **M1.5** — audit reconciliation: native `ratelimits` binding (ADR-014), no prod sourcemaps, doc drift fixed.
- [x] **M2** — domain core for matching: signatures (contextKey/functionKey/chordQuality), segment analyzer, tiers + ranking, patternHash, plausibility, Lick schema v2 (ADR-011/012/016, `docs/matching.md`).
- [ ] **M3** — progression workspace (presets, typed/grid, shared links, URL routing) + Tone.js band engine + audition + starter pack + notation overlays.
- [ ] **M4** — public catalog D1 API (cached, rate-limited), lick submission + gate + quotas, favorites/packs, sync, moderation/reports/admin, preview-D1 isolation.
- [ ] **M5** — transcription tools (local stretch, A-B loops, YouTube loops).
- [ ] **M6** — MIDI/MusicXML/JSON export + imports (iReal/MusicXML) + realbook.site link-outs.

A milestone is done only when: preview-runnable, CI green, arch + budget pass,
docs + STATUS.md updated. After each: summarize works/tests-coverage/docs/next.
