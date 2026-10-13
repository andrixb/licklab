# ADR-002: Workers Static Assets + /api Worker (not Pages + Functions)

Status: Accepted (M0).
Context: Need static PWA + `/api/*` on free tier; static hits free/unlimited,
Worker invocations billable (100k/d). SPA fallback required.
Decision: Workers Static Assets with `assets.not_found_handling:
single-page-application` + `run_worker_first: ["/api/*"]`, D1 binding, per-env
DBs. Pages + Functions rejected: two systems to configure, same limits, less
control over Worker-first routing.
Consequences: single `wrangler.jsonc`; branch previews via `versions upload`
(version preview URLs, no env matrix). Preview versions share the production
D1 binding — previews must not write test data once real tables land; M4
re-establishes isolation if needed.
Re-verify config keys per docs each milestone.
