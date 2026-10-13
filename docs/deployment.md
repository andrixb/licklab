# Deployment (Cloudflare free tier)

Serve PWA as Workers Static Assets + small Worker for `/api/*` only:

- `wrangler.jsonc`: `assets: { directory: ./dist, binding: ASSETS,
  not_found_handling: single-page-application, run_worker_first: ["/api/*"] }`,
  D1 binding `DB`, `migrations_dir: migrations`. Only `/api/*` invokes the
  Worker (billable: 100k req/d, 10 ms CPU, 429 when exceeded); static hits are
  free/unlimited. Single environment: branch previews use
  `wrangler versions upload`, which mints a version preview URL
  (`<version>-licklab.<subdomain>.workers.dev`) without touching production
  traffic; promote with `wrangler versions deploy`. Alternative considered:
  Pages+Functions — rejected (see ADR-002).
- `public/_headers`: long immutable caching for hashed assets, correct
  `application/wasm`, security headers (applies to assets only; Worker sets own).
- Limits (confirm each deploy): 20k files/deployment, 25 MiB/file, `_headers`
  100 rules, `_redirects` 2,100 rules. Samples mono/compressed, WASM < limit,
  lazy-load + service-worker cache. No SharedArrayBuffer/COOP/COEP (YouTube).
- User audio stays in IndexedDB/OPFS; nothing audio uploaded.
- CI/CD (GitHub Actions): typecheck → lint (+deps rule) → tests → build →
  budget → docs-check; then D1 migrate + `wrangler deploy` (main → production;
  PRs → `versions upload` branch preview URLs). API token +
  account id in CI secrets only. Note: preview versions share the production
  D1 binding, so previews must not write test data once real tables land (M4
  re-establishes isolation if needed).
- Budget script `scripts/budget-check.mjs`: fails if any file > 25 MiB, count >
  18,000, or initial JS > budget (M0: 400 KB; tighten per milestone here).

## How to deploy / roll back / secrets

1. Set `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` in GitHub secrets (local
   deploys use `wrangler login` OAuth instead — no secrets needed).
2. Branch preview: `npm run deploy:preview` → version preview URL (no prod traffic).
3. Prod (CI on main): `npm run db:migrate:prod && npm run deploy:prod`.
4. Roll back: `wrangler rollback` (code) + D1 Time Travel restore (data, 7-day
   free window) — full runbook in M4.
