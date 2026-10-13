# ADR-017: Band engine — Tone.js lazy, pure timing core, synths first

Status: Accepted (M3).
Context: Spec requires Tone scheduling (never setTimeout), styles
(swing/ballad/bossa/straight), tempo and per-part mute; audio timing must be
tested without listening; CC0 sample packs must not bloat the initial
payload (budget 400 KB, current initial 375 KB).
Decision: Three-way split:
1. `domain/band.ts` — deterministic generation (walking bass, 3+7 comping,
   style drum grids, lick placement) + beat→seconds conversion
   (`toTimedEvents`, count-in). Pure; property-tested; NO wall clock, NO
   AudioContext.
2. `adapters/tone/engine.ts` — implements the AudioEngine port; Tone is
   DYNAMICALLY imported on first play (stays out of the initial chunk;
   Workbox caches it after first use). `Tone.start()` failure (no gesture)
   degrades to silent-but-consistent state; Transport-scheduled callbacks
   trigger synths at scheduled times (no setTimeout).
3. `adapters/memory/audio.ts` — silent fake for contract tests and no-audio
   environments; e2e asserts UI state transitions (Play↔Stop), not sound.
Voices are Tone synths (FM bass, triangle piano, membrane/noise/metal
drums) for now; the M3.5 step swaps them for lazy-loaded CC0 sample sets
(VSCO 2 CE bass, Virtuosity drums, Salamander piano — licences verified in
Phase 0) behind the SAME port + instruction mapping.
Consequences: timing tests run in ms (no audio hardware); budget unchanged;
audio quality improves later without interface churn.
