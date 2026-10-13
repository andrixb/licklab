# STATUS.md — current state

**Milestone:** M1.5 + M2 + **M3 (workspace, band engine, audition, starter
pack)** done. Catalog/sync (M4) and Phase-2 tools (M5) ahead; M3.5 (swap
synths for CC0 samples) is the next polish step.
**Live:** production `https://licklab.licklab.workers.dev` (M2 + M3 shipped
via CI; M3 verified first on version preview `5d913703`).
**What works:**
- M2 (matching core): signatures, analyzer, tiers + ranking, plausibility,
  Lick v2. **New in M3:**
- Progression workspace at `/play`: preset chips, typed chords, stateless
  share links (`/play?c=...`), per-segment tier-ranked matches, audition a
  lick over the band, place licks into a solo chorus, all-12-keys cycle.
- Band engine (Tone, lazy-loaded on first play; synths for now — ADR-017):
  walking bass / 3+7 comping / per-style drum grids, swing/ballad/bossa/
  straight, tempo, bass/piano/drums mutes. Pure timing core, tested without
  audio (163 unit + 8 workerd + 4 Playwright flows).
- Starter pack: 8 self-written licks as static `public/starter-pack.json`
  (anonymous, offline, no API); guide-tone line on lick detail.
- Path-based URL routing (SPA fallback); `?e=e` ignored (verified platform
  noise).
**Known issues:** OAuth apps/secrets still not created (owner action);
preview versions share prod D1 (fix in M4); initial JS 375/400 KB — M4 UI
must keep lazy-loading; sample-based audio not yet wired (synths now).
**Next:** preview-verify M3, then M4 — catalog D1 tables + cached read API,
submission/gate/quotas, favorites, sync, moderation, preview-D1 isolation.


Cold-start: read `AGENTS.md`, then this file, then `docs/`.
