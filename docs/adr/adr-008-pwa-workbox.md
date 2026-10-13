# ADR-008: PWA via vite-plugin-pwa (precache shell, runtime-cache WASM)

Status: Accepted (M1).
Context: Offline at the instrument is a requirement; samples/WASM must be
cached but must not bloat install or the initial payload.
Decision: `vite-plugin-pwa` (Workbox, `autoUpdate`): precache app shell +
icons; `globIgnores` keeps the Verovio chunk out of precache;
`runtimeCaching` (CacheFirst) stores it after first notation view. Icons are
generated dependency-free (`scripts/make-icons.mjs`, PNG, valid).
Consequences: install stays ~340KB; full offline needs one notation view
(and later: one playback) while online first.
