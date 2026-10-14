# ADR-021: Full jmove integration + professional samples

Status: Accepted.
Context: Our clean-room engine (ADR-019) was correct but thin compared to
professional backing track generators. `@jmove/generator` (MIT licensed,
zero-dep TS, 1869 tests) provides production-quality pattern generation with
detailed drum patterns (ghost notes, multiple variations per style), proper
piano voicings (Evans, rootless, quartal), and sophisticated bass lines.
A JJazzLab port is impossible (LGPL-2.1 vs our GPL-3.0-only dep list, 
Java/MIDI desktop vs browser PWA); jmove's MIT licence makes *integration* 
legal. Copying jmove.it.com's UI is still forbidden (own rule: inspired-by 
only, no copied layout/assets).
Decision:
1. Full integration of `@jmove/generator` (pinned exact 1.5.1) as the primary
   pattern source. The `BandPatternProvider` port translates between our domain
   types and jmove's API: `FlatChord[]` → `ChordEvent[]`, then jmove generates
   `BassNote[]`/`CompNote[]`/`DrumHit[]`, which we convert back to `BandEvent[]`.
   Local domain engine kept as fallback for `straight` style and error recovery.
2. Professional sample integration (all legally sourced):
   - **FluidR3_GM** (MIT): Electric Piano 2 (DX7 sound), Acoustic Bass, 
     Grand Piano - same samples JMove uses, extracted from their soundfont.
   - **Casio RZ-1** (CC0): Drum machine samples for electronic/kit sounds.
   - **VSCO 2 CE** (CC0): Upright bass and piano (original).
   - **Virtuosity Drums** (CC0): Jazz kit (original).
   All samples converted to 44.1kHz mono WAV for consistency.
3. Voice variant system: mixer UI lets users select between different sound
   palettes (bass: upright/acoustic/electric, piano: upright/DX7/electric/grand,
   drums: jazz/machine). Each variant loads its own sample set via Tone.js
   Sampler. Engine reloads only affected voices on variant change.
4. Control room in OUR styling: mixer levels, Swing/Density/Strum, 
   Creativity/Conversation/Air-gaps/Harmonic-freedom, per-voice complexity,
   count-in Off/1/2 bars, seamless Transport loop, New-take seed, time display
   + segment highlight. Out of scope: granular sliders, instrument-plugin
   dropdowns (their engines), Chord Suggestion (separate product), pixel-clone
   of their screen.
Consequences: ~130KB lazy chunk for generator (initial 386KB, budget 400KB 
green); ~6MB additional samples (FluidR3_GM + Casio RZ-1); use cases async 
but UI signatures unchanged; domain engine + all its tests kept as fallback.
jmove provides patterns, our samples provide sounds - full integration gives
professional-quality backing tracks with legal, high-quality audio. All 
samples properly attributed in ATTRIBUTION.md.
