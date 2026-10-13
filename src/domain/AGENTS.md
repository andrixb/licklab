# domain rules

Pure TypeScript only. No imports from React, Tone, Verovio, Dexie, D1, or DOM
(enforced by lint). All harmonic logic (pitch/interval/chord types, chord-symbol
parsing, degree<->pitch with correct enharmonic spelling, Lick/Song entities,
harmonic matching, LWW sync rules) lives here and is test-first with fast-check
property tests (round-trips across all 12 keys, sync convergence).
