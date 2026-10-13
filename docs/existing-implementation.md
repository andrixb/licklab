# Existing implementation audit (Phase 0, step 0)

Audited 2026-10-13 at commit `8acf3a9` (main, synced with deployed
production `https://licklab.licklab.workers.dev`, health `version 0.0.1`,
`schemaVersion 1`). Verified locally: typecheck, lint, depcruise, 69 unit +
7 workerd tests, build, budget, docs-check — all green. Coverage: domain
97% lines, application 100% lines (thresholds ≥90/≥90/≥85 enforced in
`vitest.config.ts`).

## What LickLab is today

A local-first, **personal** lick library PWA (the earlier scope): create jazz
licks via ABC entry, view engraved notation (Verovio WASM) in
concert/Bb/Eb/bass views, search/filter locally, sync identity via OAuth.
There is **no community database, no progression workspace, no band engine,
no public catalog** yet — those are the new prompt's core asks.

## Stack and versions (package.json)

TypeScript 5.9 strict · React 19 · Vite 7 · vite-plugin-pwa 2 (Workbox) ·
Tailwind v4 · Dexie 4 · Verovio 6.3 (lazy WASM) · better-auth 1.7 +
@better-auth/kysely-adapter + kysely 0.29 (own D1 dialect) · Wrangler 4.149 ·
Vitest 4 + @cloudflare/vitest-plugin 1 (workerd+D1) · fast-check 3 ·
Playwright 1.49 · dependency-cruiser 17 + eslint-plugin-boundaries 5 ·
Node >= 22 · License GPL-3.0-or-later (ADR-009).
Not yet installed: Tone.js, Web MIDI code, exporters, importers (ADR-004
defers heavy deps to feature milestones).

## Folder layout (matches the target architecture)

`src/domain` (pure TS: pitch, chords, transpose, lick, song, abc, hello) →
`src/application` (ports.ts + use cases: health, licks, lickInput, lickViews,
seeds) → `src/adapters` (dexie, memory, notation/verovio) + `src/worker`
(index, auth, d1-dialect) + `src/ui` (React, composition root). Layer rule
enforced twice (boundaries + depcruise, CI-failing), one lint-excepted file
(`ui/composition.ts`). Nested AGENTS.md in all five layers. `migrations/`,
`docs/` with 10 ADRs + 9 docs, `scripts/` (budget-check, docs-check,
make-icons), `tests/{unit,worker,e2e}`.

## API routes (Worker, `/api/*` only; `{ok,data|error}` envelope)

- `GET /api/health` — public, version + schemaVersion.
- `/api/auth/*` — Better Auth handler (Google/GitHub OAuth), per-IP 30/min.
- `GET /api/me` — session user. `GET /api/account/export` — identity JSON.
- `DELETE /api/account` — hard delete (CSRF/origin-gated, 10/min).
- Everything else `/api/*` → 404. **No `/api/licks`, no catalog/sync routes.**

## Storage and schema

- **Dexie** is the source of truth: one DB per namespace
  (`licklab-local` / `licklab-<userId>`), schema v1,
  `licks: "[ownerId+id], ownerId, updatedAt"`, full-Lick JSON + filter
  columns (function/artist/difficulty/title) + soft-delete tombstones.
- **D1 `licklab`** (prod DB id `6c19499e-…c3c`): only auth tables (`user`,
  `session`, `account`, `verification`, `allowed_email`) + M0 `_m0_ping`
  smoke table. **No lick/song/favorite/pack/report tables yet.**
- Lick domain model (schemaVersion 1) deviates from the target prompt —
  see Gaps.

## Deployment

Workers Static Assets + Worker (ADR-002): `run_worker_first: ["/api/*"]`,
SPA fallback, `_headers` (immutable hashed assets, CSP incl. YouTube frames,
nosniff). Previews via `wrangler versions upload` version URLs — **preview
versions share the production D1 binding** (documented trade-off). GitHub
Actions: `ci.yml` (typecheck/lint/deps/unit/workerd/build/budget/docs-check)
and `deploy.yml` (PR → version preview; main → migrate prod + deploy).
Prod is live and serves this exact config. Budget: initial JS 358 KB
(< 400 KB), 23 dist files, lazy Verovio chunk 8 MB; **known issue: 8
sourcemaps ship in dist** (STATUS.md acknowledges).
**OAuth apps/secrets are NOT yet created** — sign-in cannot complete until
the 4+1 secrets in `docs/deployment.md` are configured. `BETTER_AUTH_SECRET`
missing in prod means `/api/auth` sign-in fails; signed-out mode works.

## Tests status

69 unit (domain property tests incl. 12-key round trips; port contract
tests vs memory + Dexie/fake-indexeddb + Verovio + Worker shape) · 7 workerd
(auth cross-user deletion, CSRF 403, gate, rate-limit 429, export leak,
D1 smoke) · 2 Playwright e2e (create→notation→transpose→delete; sign-in
menu). No API-route test for 404 envelope, no migration-from-previous-version
test harness (migrations are `IF NOT EXISTS`, applied in workerd setup), no
EXPLAIN QUERY PLAN tests yet.

## The `?e=e` mystery — solved: it is a no-op

Verified three ways: (1) the built bundle contains **zero** uses of
`URLSearchParams`/`location.search`/query parsing; (2) `/?e=e` returns the
byte-identical edge-cached `index.html` (same ETag, `cf-cache-status: HIT`)
as `/`; (3) no occurrence in git history. The app has no URL routing at all
(views are React state). Conclusion: `?e=e` is external noise (redirect/link
artifact), harmless today. Real gap it exposed: **no deep links** — the new
product needs URL routing (shared progression links, lick permalinks); plan
for it in the M2 workspace milestone.

## Gaps against the new prompt (community lick database)

1. **No public catalog**: Lick has no `visibility`, `contextKey`,
   `functionKey`, `chordQuality`, `patternHash`, `license`,
   `moderationState`, `instrumentRange`; `source` is required (prompt:
   optional); function is author-declared, not derived. No D1 lick table, no
   anonymous browse/search API, no like counters.
2. **No signatures/matching**: the core concept (key-independent
   `contextKey`, progression segment analyzer, matching tiers + ranking)
   does not exist. `song.ts` has typed-bar parsing only; no presets, no
   shared links, no bar-grid editor.
3. **No audition/band**: Tone.js absent; no playback at all (notation-only
   today), no samples, no solo-chorus/all-12-keys modes, no guide-tone
   overlay (port + domain helper exist partially: `guideToneDegrees`).
4. **No contribute pipeline**: no Web MIDI, no click-in editor, no
   plausibility check, no duplicate detection, no contributor gate/quotas.
5. **No collections**: favorites, packs, reports, moderation admin.
6. **No sync** of licks/songs (SyncRemote is a stub interface; export
   endpoints return empty `licks: []` placeholders).
7. **No starter pack** as static asset (2 inline seeds exist — the seed
   mechanism maps well onto the starter-pack requirement).
8. Smaller: no schemaVersion migration runner in Dexie past v1; sourcemaps
   shipped; ADR-003 index line still says "Proposed" while the ADR says
   "Accepted"; roadmap.md has a duplicated M1 line (drift fixed with this
   audit).

## Risks

- **Preview/prod D1 share one DB** — acceptable while tables are auth-only,
  becomes unsafe the moment public catalogs or user data land. Mitigate in
  M4 (env var + preview D1, or Access-gated preview).
- **Anonymous public read design not yet built** — free-tier D1/Worker budget
  is the hard constraint; the snapshot+cache strategy below must land *with*
  the catalog, not after.
- `dangerouslySetInnerHTML` renders Verovio SVG built from user-authored ABC
  (title embedded in `T:`) — Verovio XML-escapes, but add a hardening test
  (XSS in title/tags/notes rendered as plain text) before UGC is public.
- In-isolate rate limits are best-effort; the native `ratelimits` binding is
  available on the free plan (per-colo, ~0 CPU) and should replace them.
- OAuth apps not created → sign-in unverifiable until secrets configured.

## Proposed incremental migration plan (no rewrite)

The existing baseline satisfies the architecture, auth, deployment and test
requirements of the new prompt; keep it and build the missing product layers
on top:

- **M1.5 (audit reconciliation)**: characterization tests already green;
  fix doc drift; adopt native `ratelimits` binding; disable prod sourcemaps;
  create OAuth apps + wire secrets (user action). No schema change.
- **M2 (domain core extension)**: add `contextKey`/`functionKey`/chordQuality
  derivation, progression segment analyzer, matching tiers + ranking,
  patternHash, plausibility check to `domain` (extend `song.ts` → progression,
  keep Tonal out — own primitives already satisfy spelling tests; ADR).
  Lick entity v2 (new optional fields) + Dexie migration v1→v2 + JSON-export
  versioning. Heavy fast-check coverage (invariance under transposition).
- **M3 (workspace + audition)**: URL routing + shared progression links,
  presets, bar-grid editor, segment/matching UI, Tone.js band engine behind
  `AudioEngine` port, CC0/CC-BY samples lazy-loaded, starter pack static
  asset from the seed mechanism, guide-tone overlay, solo-chorus + 12-keys.
- **M4 (catalog + contribute)**: D1 `lick`/`like`/`tag` tables (0003) with
  the indexed signature schema, anonymous cached read API (`/api/licks`,
  batched signature lookup), submission + gate + quotas, favorites/packs,
  sync (changes API, LWW), preview-D1 isolation, moderation + reports +
  admin behind Access, EXPLAIN QUERY PLAN + migration-upgrade tests.
- **M5** = prompt's Phase 2 (transcription helper, imports, exports,
  realbook.link-outs).

ADR plan: ADR-011 lick-schema-v2 (new fields, migration), ADR-012 signature
format + analyzer, ADR-013 public read path (edge cache + scheduled
snapshots), ADR-014 native ratelimits binding, ADR-015 default license
CC BY 4.0 + contributor terms, ADR-016 keep own theory primitives vs Tonal.
