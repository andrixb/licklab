# STATUS.md — current state

**Milestone:** M1.5 + M2 + M3 + **M4 (catalog + sync)** done. Phase-2 tools (M5) ahead; M3.5 (swap synths for CC0 samples) is the next polish step.
**Live:** production `https://licklab.licklab.workers.dev` (M2 + M3 shipped via CI; M3 verified first on version preview `5d913703`; M4 sync verified on preview `a10fd796`).
**What works:**
- M2 (matching core): signatures, analyzer, tiers + ranking, plausibility, Lick v2.
- **M3 (workspace, band engine, audition, starter pack):**
  - Progression workspace at `/play`: preset chips, typed chords, stateless share links (`/play?c=...`), per-segment tier-ranked matches, audition a lick over the band, place licks into a solo chorus, all-12-keys cycle.
  - Band engine (Tone, lazy-loaded on first play; synths for now — ADR-017): walking bass / 3+7 comping / per-style drum grids, swing/ballad/bossa/straight, tempo, bass/piano/drums mutes. Pure timing core, tested without audio (163 unit + 8 workerd + 4 Playwright flows).
  - Band musicality pass (ADR-019, clean-room, JJazzLab-concepts only): voice-led walking bass + 3-note rootless shells, section-aware comping rhythms, ghost/fill drums, jazz velocity map, room+glue FX bus. Same ports, 235 unit green, initial JS 384/400 KB.
  - Band engine 2 (ADR-021): `@jmove/generator` 1.5.1 (MIT, pinned) as lazy pattern source for swing/ballad/bossa — Evans voicings, groove templates, seedable takes — behind a new provider port with local-engine fallback; control room (mixer, feel, musicality, complexity, count-in, loop, takes, playhead) in LickLab styling. 201KB lazy chunk, initial 386/400 KB.
  - Band engine 2 parity (ADR-022, verified on preview `7bebffb2`): coordinated `generateEnsemble` with all Feel/Musicality/Complexity wired (deterministic per seed), MIDI->note fix (was ~2 octaves low), direct wiring + live mixer/instrument swaps, correct sample exts (Casio `.ogg`, FluidR3 `.wav`). 12-bar Bb blues @120: all samples 200, AudioContext running, spectrum matches demo per-band within ~2x (was 10,000x dull), Stop/double-Play clean, 242 unit green, initial 387/400 KB.
  - Chord authority (ADR-023, local only — NOT deployed): LickLab keeps no chord-interpretation code; quality meaning comes from JMove `parseQuality` (thin adapter passes extensions verbatim, documented aliases only where JMove 1.5.1 provably misreads). Previously-rejected notations now parse and sound (`G7alt`, `Bb7/D`, `CM7`, `CΔ7`, `C°7`, `-7`/`min7`/`^7`/`ø`/`o7`/`h7`, `m9/m11/m13`, `69/add9`, `sus2/sus4/9sus`, `dim`, `aug7`/`+7`, `7#9#5`, `Bb7#9/Bb7b9/Bb13`); storage/signature codes byte-stable (no migration). Composition root loads Dexie/use-cases/domain-chord code dynamically + Library/Detail/New views lazy: entry 387KB -> 257KB (budget green). Proven: unit parity vs JMove itself, browser event-for-event golden file, rendered-audio pitch (Bb2, A4=440, Bb7 shell, +/-30c). Upstream gaps reported, not patched: case-sensitive `mMaj7`/`M7`/`power5`, `Δ`/`°` normalization, slash-bass generation.
  - Starter pack: 8 self-written licks as static `public/starter-pack.json` (anonymous, offline, no API); guide-tone line on lick detail.
  - Path-based URL routing (SPA fallback); `?e=e` ignored (verified platform noise).
- **M4 (catalog + sync):**
  - Edge-cached public reads (ADR-013): Cache API + SHA-256 ETag (`304` on `If-None-Match`, no body), `s-maxage=300, stale-while-revalidate=60`, `RL_READ` rate-limit binding (120/min/IP); lookup capped at 100 signatures.
  - Account deletion is complete: hard-deletes licks, pack + membership, favorites, likes, reports, quota, progression and auth rows — asserted by a workerd test that no row survives in any table.
  - **Community catalog API**: public/private licks, likes, favorites, packs, progressions, reports, admin moderation (hide/unhide, dismiss/action reports).
  - **Sync engine (local-first)**: Dexie source of truth, D1 synced copy. `/api/sync/changes` (pull since cursor) + `/api/sync/push` (batch with LWW per record, server stamps). Tombstones for deletes. Composite PKs `(id, owner_id)` so users have independent ID spaces. Cross-user isolation enforced and tested. Chunked writes respect D1 free-tier caps (≤40 statements, ≤64KB per chunk). Property-tested LWW convergence.
  - 30+ workerd tests: cache headers, ETag 304, session-gated writes, tampered `ownerId` rejected, per-user rate caps, sync round-trip, LWW, tombstones, cross-user isolation, validation, oversized pushes.
  - Auth posture (ADR-020): every CUD route 401s without login (tested per route); all state-changing calls need same-origin (403 on foreign/missing Origin, zero rows written); catalog reads + lookup + playback stay anonymous.
**Known issues:** OAuth apps/secrets still not created (owner action); preview versions share prod D1 (fix in M4 — partially: sync uses preview DB but catalog reads hit prod); initial JS 375/400 KB — M4 UI must keep lazy-loading; sample-based audio not yet wired (synths now).

**Next (M5):**
- Submission UI (create lick/progression/pack in app → sync to D1)
- Preview-D1 isolation (separate DB per preview deploy)
- Sample-based audio (M3.5: CC0 sample packs for band engine per ADR-018)
- Export/import (MusicXML, iReal, MIDI)
- YouTube loop integration (IFrame playback only, no extraction)


Cold-start: read `AGENTS.md`, then this file, then `docs/`.
