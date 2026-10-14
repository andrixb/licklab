# ADR-019: Band musicality — section model, voice-leading, jazz mix (clean-room)

Status: Accepted.
Context: The M3 band engine (`domain/band.ts` + Tone samplers) was metronomically
correct but sounded mechanical: 2-note shells with no voice-leading, one fixed
comping rhythm per style, flat velocities, dry direct-to-speakers mix. JJazzLab
(LGPL-2.1, Java/MIDI/FluidSynth) cannot be ported — wrong platform, Investor-scale
style-file ecosystem, and a copyleft version incompatible with our GPL-3.0-only
dependency list — but its *concepts* (sections with fills, per-instrument phrases
adapted to chords, bass memory, dynamics across the form) transfer as ideas.
The apvilkko/backing-tracks demo (MIT, browser, unmaintained) confirms the same
layering: chord lane → pattern → WebAudio mixer with per-track gains.
Decision: clean-room upgrade, no copied code/patterns/samples:
1. `domain/band.ts` (still pure/deterministic, seeded hash instead of RNG):
   walking bass with bass-memory voice-leading + alternating below/above chromatic
   approaches; 3-note rootless piano shells (3rd+7th+9th/5th) with top-led octave
   choice (≤7-semitone top motion); section-aware rhythms (Main A/B, Charleston
   and anticipated variants, sparse fill bar); form-aware drums (ghosts, triplet
   turnaround fills, crash on form top / every 8 bars). Swing triplet ride grid
   unchanged so the subdivision contract holds.
2. `adapters/tone/schedule.ts` (pure): jazz velocity map (feathered kick ~0.32,
   ghost snares, chick hats, ride on-beats forward / off-beats light, comping under
   the bass, lick on top) with ±deterministic humanization; drum durations let the
   ride ring (0.5 s) and keep hats short. Timing grid untouched (timing contract).
3. `adapters/tone/engine.ts`: Tone-only FX bus (Freeverb room send + master
   Compressor, no new deps, still lazy) with jazz voice balances
   (bass −8, piano −11, drums −10, lick −3); guarded fallback to direct wiring so
   the unit-test Tone mock still passes.
Consequences: 42 band/audio tests green (7 new), full suite 235 green,
typecheck/lint(deps)/build/budget/docs-check green, initial JS 384/400 KB —
musicality improves with zero interface churn (same `BandEvent`/`AudioEngine` port).
