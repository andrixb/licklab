# ADR-022: Match the JMove demo integration (ensemble + pitch)

Status: Accepted.
Context: Playback on `/play` sounded muffled/chaotic and no control moved the
sound. Browser observation (Playwright, live `/play` + `jmove.it.com/app`,
12-bar Bb blues @120) showed: all default samples 200 audio/wav (no SPA
fallback), AudioContext running, transport started, engine label
`jmove 1.5.1` — yet analyser taps measured highs ~5e-10 vs bass ~3e-04
(-58 dB, essentially no brilliance), and two `generateBand` calls with the
same seed gave different takes (329 vs 319 events).
Decision:
1. Use `generateEnsemble` (coordinated drums->bass->piano, same call the demo
   makes) with the full Feel/Musicality/Complexity mapping (density,
   swingAmount, strumMs, creativity, conversation, airGaps, harmonicFreedom,
   drum/piano/bass granular via resolvers, seed, measureInfo). Delete the
   three separate unseeded calls that ignored `BandGenerateOptions`.
2. Convert MIDI to Tone note names (`midiToNote`, sharps) before
   `Sampler.triggerAttackRelease`. `Frequency(number)` means Hz, not MIDI
   (60 -> 60 Hz -> B1); every note played ~2 octaves low. The demo converts
   via `midiToToneName` for the same reason.
3. Direct sampler wiring (no full-wet reverb + compressor wash); per-part
   volumes like the demo's Gains; live `setLevels` (mixer moves audibly
   mid-take); voices looked up at trigger time so instrument swaps alter the
   remaining notes; load-then-swap + trigger guard so swaps never page-error.
4. Fix sample extensions/paths to the files on disk (Casio RZ-1 is `.ogg`,
   same files the demo loads; FluidR3 `.wav`; dx7/electric map to
   `electric_piano_2`, electric bass to `acoustic_bass` so every selector
   moves the sound). Fix `isPlaying` (`boolean === "started"` was always
   false), per-playback stop flag (double Play never stacks, Stop releases
   all voices + cancels the transport).
Consequences: takes are deterministic per seed, every slider alters the next
take, volumes/instruments move live; spectrum on preview `7bebffb2` matches
the demo within ~2x per band (was 10,000x dull); 242 unit green, budget
387/400 KB. Worker `not_found_handling: single-page-application` stays (no
missing assets, so no HTML fallback for samples).
