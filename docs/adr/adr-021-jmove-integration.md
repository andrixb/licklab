# ADR-021: jmove pattern source + control room (no port, no clone)

Status: Accepted.
Context: Our clean-room engine (ADR-019) was correct but thin next to
`@jmove/generator` (MIT, zero-dep TS, 1869 tests, seedable ensemble:
Evans voicings, stochastic drums, groove templates). A JJazzLab port is
impossible (LGPL-2.1 vs our GPL-3.0-only dep list, Java/MIDI desktop vs
browser PWA); jmove's MIT licence makes *integration* legal instead.
Copying jmove.it.com's UI is still forbidden (own rule: inspired-by only,
no copied layout/assets).
Decision:
1. New `BandPatternProvider` port (`application/ports.ts`): `flat + style +
   part + tempo + opts → beat-grid BandEvents`. Implementations: `adapters/
   local` (domain engine, offline fallback, `straight`) and `adapters/jmove`
   (lazy `import()`, pinned exact 1.5.1). Composition picks jmove for
   swing/ballad/bossa and falls back to local on any failure; the engine
   label in the UI says which won. `straight` always uses local.
2. Translation is explicit and tested: pitch-class roots (never exotic
   spellings), 11-quality map, seconds↔beats both ways, GM→role map with
   toms/side-stick/china/splash aliased to family voices until tom samples
   join the pack, velocities preserved via new optional `BandEvent.velocity`
   (schedule honors it, mixer levels multiply it), strum expanded to
   micro-timed events, seeds derived per content (same input → same take).
3. Control room in OUR styling: mixer levels (new optional `BandPlayOpts`
   through `AudioEngine.play`), Swing/Density/Strum, Creativity/Conversation/
   Air-gaps/Harmonic-freedom, per-voice complexity, count-in Off/1/2 bars,
   seamless Transport loop, New-take seed, time display + segment highlight
   via new `getPositionSeconds()` and domain `chordAtBeat()`. Out of scope:
   granular sliders, instrument-plugin dropdowns (their engines), Chord
   Suggestion (separate product), pixel-clone of their screen.
Consequences: 201KB lazy chunk (initial +2KB, budget 386/400 green);
use cases async but UI signatures unchanged; domain engine + all its tests
kept as fallback. jmove ships patterns only (no sounds): the band still
sounds through our voices (CC0 samplers + FM EP), which is why the engine
also gained a convolver room (worklet-free for our CSP), a limiter, and a
DX7-style FM piano voice. Risk accepted: 0-star upstream — exact pin +
fallback + contract tests (downbeat roots, determinism, gating) contain
API churn.
