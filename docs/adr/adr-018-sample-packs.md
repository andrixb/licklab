# ADR-018: Sample packs for band engine (M3.5)

Status: Accepted (M3.5).
Context: M3 introduced a pure domain band engine with synthesized voices
(FMSynth, Synth, MembraneSynth, etc.). M3.5 replaces synth voices with
real instrument samples for higher audio fidelity while staying within
the free-tier budget (initial JS ≤ 400 KB, lazy chunks < 25 MiB).

Decision:
- Bass: VSCO 2 CE Contrabass (CC0), 4 pizzicato samples (C2, E2, G2, C3).
- Drums: Virtuosity Drums (CC0), 5 pieces (Kick, Snare, HiHat, Ride, Crash).
- Piano: Salamander Grand Piano V3+ (CC BY 3.0), 15 notes C3–C5.
- All samples converted to WAV, served as static assets under `/samples/`.
- Tone.js `Sampler` loads samples on first play (dynamic `import()` of `tone`).
- Service Worker caches samples with `NetworkFirst` (starter pack) /
  `CacheFirst` (tone chunk) for offline-after-first-play.
- Attribution page at `/attribution` for CC BY 3.0 (Salamander).

Consequences:
- Audio fidelity significantly improved (real instrument timbre).
- Initial JS payload unchanged (samples not in initial bundle; lazy chunks).
- Samples cached after first play → fully offline-capable after first use.
- M3.5 is a drop-in replacement for synth voices; no API changes.
- License compliance: CC0 (VSCO, Virtuosity), CC BY 3.0 (Salamander, attribution page at `/attribution`).
- Future: expand sample mappings (more velocity layers, articulations).