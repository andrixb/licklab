# AGENTS.md — LickLab

LickLab: local-first PWA to store jazz licks and try them over standards.
Static PWA + thin Worker `/api/*` + D1. UX inspired by realbook.site/earbop.app —
no copied assets/branding, no scraping (link-out + user-provided files only).

## Commands

| Task | Command |
|---|---|
| install | `npm ci` |
| dev (app, port 5173, proxies /api → :8787) | `npm run dev` |
| dev (Worker+D1 local) | `npx wrangler dev` |
| typecheck | `npm run typecheck` |
| lint (incl. arch rule) | `npm run lint && npm run lint:deps` |
| unit tests | `npm run test` |
| worker+D1 tests (workerd) | `npm run test:worker` |
| coverage | `npm run test:coverage` |
| e2e (needs dev server) | `npm run test:e2e` |
| build + budget + docs-check | `npm run build && npm run budget && npm run docs:check` |
| local D1 migrate | `npm run db:migrate:local` |
| prod migrate/deploy | `npm run db:migrate:prod` then `npm run deploy:prod` |
| branch preview (version URL, no prod traffic) | `npm run deploy:preview` |
| dry-run wrangler config | `npm run cf:check` |

Secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, D1 ids) live only in
CI secrets / local `.dev.vars` (gitignored) — never committed.

## Architecture (clean/hexagonal)

```
src/domain -> src/application -> src/adapters, src/worker, src/ui
```
Dependencies point **inward only**, enforced by `eslint-plugin-boundaries`
+ `depcruise` (`npm run lint:deps`, fails CI). No cycles.

- `domain/`: pure TS. No React/Tone/Verovio/Dexie/D1/DOM imports. Pitch,
  chords, transposition w/ enharmonics, Lick/Song entities, harmonic matching,
  LWW sync rules. Matching always runs client-side, never Worker/SQL.
- `application/`: use cases + **port interfaces** (`ports.ts`) + shared
  request/response schemas (single source for client + Worker).
- `adapters/`: Dexie, D1, HTTP SyncRemote, Tone, Verovio, Web MIDI, MusicXML/
  iReal importers, MIDI/MusicXML exporters, YouTube IFrame wrapper. Swappable.
- `worker/`: routing → auth check → validate (shared schema) → use case → JSON.
  No business logic, no heavy compute.
- `ui/`: React + view-models only. Talks to use cases, never adapters directly.

## Conventions

- TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
  No `any` without justification. Tests colocated (`*.test.ts`).
- New source files carry the short GPL header (`Copyright (C) 2026 LickLab
  contributors … GPL-3.0-or-later`). Never add GPL-2.0-only deps (see ADR-009).
- Versioned schemas (local/D1/JSON export) + `migrations/*.sql` + changelog in
  `docs/data-and-sync.md`. JSON export carries `schemaVersion`.
- Every significant decision → short ADR in `docs/adr/` + line in `index.md`.

## Adding things

- New adapter: implement the port in `src/adapters/<name>/`, contract-test vs.
  fake + real (fake-indexeddb / workerd D1). UI/use cases untouched.
- New importer: `src/adapters/importers/<format>/` + golden-file fixtures
  (self-written or user-provided only — never copyrighted charts).
- New use case: `src/application/<name>.ts` (ports only) + unit + property tests.
- New API route: validate with shared schema, `ownerId` from session only,
  owner-scoped query, add API + cross-user tests.
- New migration: `migrations/NNNN_<name>.sql`, test empty-DB + upgrade path,
  log it in `docs/data-and-sync.md`.

## Cloudflare free-tier constraints

Workers 100k req/d, 10 ms CPU/invocation; D1 5M rows read / 100k written per
day (00:00 UTC reset, queries fail when exceeded); 10 DBs, 500 MB/DB, 2 MB/row,
100 cols/table, 100 params/query, 50 queries/invocation; static 20k files,
25 MiB/file, `_headers` 100 rules. Only `/api/*` runs the Worker
(`run_worker_first`); static hits are free. No SharedArrayBuffer/COOP/COEP
(breaks YouTube). Single-threaded WASM, lazy-load samples/WASM, budget check
(25 MiB/file, 18k files, JS payload cap in `docs/deployment.md`).

## Definition of done

Feature works on preview deploy; typecheck+lint+tests+build+budget green;
arch rule passes; docs + `STATUS.md` updated in same change; coverage ≥90%
domain/application; no copyrighted fixtures; no audio/scores uploaded.

## Never do

- Never scrape/crawl realbook.site; link-out + user files only.
- Never extract audio from YouTube (IFrame playback + loops only).
- Never upload copyrighted scores or audio to D1; chord changes+metadata only.
- Never run destructive SQL against production D1; previews use preview DB.
- Never commit secrets; never store passwords; never log tokens/session IDs/emails.
- Never take `ownerId` from request input — session only.
- Never put business logic or heavy compute in the Worker.
- Never use passwords / home-made crypto for auth (OAuth + maintained lib).
