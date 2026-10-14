# STATUS.md — current state

**Milestone:** M1.5 + M2 + M3 + **M4 (catalog + sync)** done. Phase-2 tools (M5) ahead; M3.5 (swap synths for CC0 samples) is the next polish step.
**Live:** production `https://licklab.licklab.workers.dev` (M2 + M3 shipped via CI; M3 verified first on version preview `5d913703`; M4 sync verified on preview `a10fd796`).
**What works:**
- M2 (matching core): signatures, analyzer, tiers + ranking, plausibility, Lick v2.
- **M3 (workspace, band engine, audition, starter pack):**
  - Progression workspace at `/play`: preset chips, typed chords, stateless share links (`/play?c=...`), per-segment tier-ranked matches, audition a lick over the band, place licks into a solo chorus, all-12-keys cycle.
  - Band engine (Tone, lazy-loaded on first play; synths for now — ADR-017): walking bass / 3+7 comping / per-style drum grids, swing/ballad/bossa/straight, tempo, bass/piano/drums mutes. Pure timing core, tested without audio (163 unit + 8 workerd + 4 Playwright flows).
  - Band musicality pass (ADR-019, clean-room, JJazzLab-concepts only): voice-led walking bass + 3-note rootless shells, section-aware comping rhythms, ghost/fill drums, jazz velocity map, room+glue FX bus. Same ports, 235 unit green, initial JS 384/400 KB.
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
