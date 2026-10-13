# STATUS.md — current state

**Milestone:** M0 (skeleton + Phase 0 research) — complete and deployed.
**Live:** production `https://licklab.licklab.workers.dev` (Worker + SPA +
remote D1 migrated with `0001_init.sql`). Branch previews via
`wrangler versions upload` (version preview URLs, no prod traffic).
Verified via `wrangler dev --remote`: `/api/health` → ok, `/api/ping-db` →
`db: up`. (Direct `workers.dev` HTTPS fails from this sandbox — old TLS lib —
so confirm in your browser.)
**What works:** hello-world PWA + `/api/health` + `/api/ping-db` Worker routes.
CI runs typecheck, lint (+arch rule, zero violations), unit tests (7 passed),
build, budget (5 files, top-JS 218 KB / 400 KB), docs-check (5 ADRs, 9 docs).
Coverage: 100% on domain+application (M0 placeholder; ≥90% target carries to M1).
**Known issues:** preview versions share the prod D1 binding (single-env
simplification — previews must not write test data once real tables land);
Workerd D1 tests deferred to M4 (`@cloudflare/vitest-plugin` installed, not
wired); heavy deps (Tone/Verovio/Dexie) deferred per ADR-004; CI GitHub secrets
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) not yet set — local deploys
use `wrangler login` OAuth.
**Next:** M1 (domain model + local lick storage + notation).

Cold-start: read `AGENTS.md`, then this file, then `docs/`.
