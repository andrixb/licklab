# ADR-018: Sample packs for band engine (M3.5)

Status: Accepted (M3.5); revised in M3.5 fix (see bottom).

Context: M3 introduced a pure domain band engine with synthesized voices
(FMSynth, Synth, MembraneSynth, etc.). M3.5 replaces synth voices with real
instrument samples for higher audio fidelity while staying within the
free-tier budget (initial JS ≤ 400 KB, lazy chunks < 25 MiB).

Decision:
- Bass: VSCO 2 CE Solo Contrabass, pizzicato — 5 notes E1–G#2 (CC0).
- Drums: Virtuosity Drums ("house" jazz kit), overhead ("oh") mix, medium
  velocity — Kick, Snare, HiHat (closed), Ride, Crash (CC0).
- Piano: VSCO 2 CE Upright Piano, medium velocity — 8 notes C#3–F5 (CC0).
  The same files back the lick voice (a lick is a melodic line over the band).
- The lick sampler shares the piano files instead of getting its own set.
- Every file is MONO 44.1 kHz 16-bit WAV, trimmed (piano 2.2 s, bass 1.2 s,
  ride/crash 2.5 s) — Tone already cuts playback to the requested duration.
- Pack lives in `public/samples/<voice>/` (Vite copies `public/` verbatim, so
  the files are actually served and deployed) and is requested at
  `/samples/<voice>/…`.
- Tone.js `Sampler` loads samples on first play (dynamic `import()` of `tone`).
- Service Worker caches samples with `CacheFirst` after first play, never
  precached, so install stays light and offline works after first audition.

Consequences:
- Initial JS payload unchanged (samples not in initial bundle; lazy chunks).
- The pack is ~2.6 MB across 18 files (well inside the 25 MiB/file, 20k files
  static budget); rebuilt with `npm run samples` (`node scripts/build-samples.mjs`).
- Loading is awaited properly: Tone's `Sampler.loaded` is only a boolean
  getter, so the adapter promises on `onload`/`onerror` instead. A 404 (or a
  decode failure) now fails loudly instead of throwing mid-playback.
- License compliance: every source is CC0 1.0 — no attribution gate, nothing
  to copyleft. Credits are recorded in `public/samples/ATTRIBUTION.md`.

Revision (M3.5 fix #2 — timbre):
- Kick/snare come from their CLOSE mics (kickmic/snaremic); the overhead ("oh")
  mix has almost no low end and made the kick a bright click. Cymbals/hats stay
  on the overheads, where they were actually recorded.
- Bridges gaps with a verified neighbour transposed rather than an upstream
  file, when the upstream file does not sound its label.
- The piano/lik range now runs to C#6 (licks reach that high); the old F5 ceiling
  forced Tone to repitch by up to 7 semitones.
- The sample pitches are asserted at build time AND in unit tests: no file may
  drift more than 2 semitones from a mapped note, and no mapped note may be
  more than half a semitone off its filename.
