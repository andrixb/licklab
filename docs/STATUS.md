# STATUS.md — current state

**Milestone:** M1.5 (audit reconciliation) + **M2 (matching domain core)**
done on top of the community-database replan. Accounts/auth remain done from
the earlier milestone; songs/band (M3), catalog API + sync (M4) ahead.
**Live:** production `https://licklab.licklab.workers.dev` (unchanged this
milestone — M2 is client-side domain + docs only).
**What works (new in M2):**
- Signatures: `contextKey` (quality@rootInterval:beats), `functionKey`
  (rule set incl. ii-V-I/ii-V-i/turnaround/V-I±tritone/cycle), `chordQuality`,
  `patternHash` (ADR-012) — derived in `parseLick`, never trusted from input.
- Progression entity + presets + segment analyzer (longest-first greedy
  coverage, blues.12bar anchors), matching tiers 1/2/3 + likes/recency
  ranking, plausibility check (warn-only) — all pure domain.
- `findLicksForProgression` application use case; Lick schema v2 (ADR-011,
  v1 rows normalize on read); `ratelimits` Worker binding (ADR-014); no
  prod sourcemaps.
**Tests:** 123 unit (was 69; +signatures/analyzer/matching/plausibility incl.
12-key transposition invariance properties) + 8 workerd (added native-binding
path); coverage domain 96–99%, application 100% (thresholds hold).
**Known issues:** OAuth apps/secrets still not created (owner action,
docs/deployment.md table); preview versions share prod D1 (isolate in M4);
matching docs: `docs/matching.md`.
**Next:** M3 — progression workspace (URL routing + shared links, presets,
bar grid), Tone.js band engine behind ports, starter pack static asset.

Cold-start: read `AGENTS.md`, then this file, then `docs/`.
