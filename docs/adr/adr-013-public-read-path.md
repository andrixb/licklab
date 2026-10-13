# ADR-013: Public read path — edge-cached D1 reads; snapshots as escalation

Status: Accepted (implemented M4).
Context: Anonymous browsing shares the free budget (Worker 100k req/d, D1
5M rows read/d). Reads must be cheap and degrade gracefully.
Decision (layered, all now shipped):
1. Starter pack ships as a STATIC asset (free, offline, zero API).
2. Catalog reads: `GET /api/licks?...` and batched `POST /api/licks/lookup`
   (signatures in one `IN (...)`, ≤100 params) → Worker checks the **Cache
   API** first, else one indexed D1 query, compact paginated JSON,
   `cache-control: public, s-maxage=300, stale-while-revalidate=60` + a
   SHA-256 ETag (`304` on `If-None-Match`, no body). `RL_READ` rate-limit
   binding = 120 req/min per IP (ADR-014). Result caps: `limit` ≤ 50,
   lookup ≤ 100 signatures.
3. Client keeps opened licks in IndexedDB; on 429/limit errors UI shows
   "service busy" and falls back to cached + starter-pack licks.
Estimate (1k daily visitors, ~25 API hits each ≈ 25k req/d, ~150k rows read
with cookie-cached sessions) — comfortable under caps; ~4k visitors/day
before Worker requests bind.
IMPLEMENTED. Escalation (build only if it binds): scheduled CI job (or
Cron) regenerates **static snapshot shards** by contextKey/functionKey in
`/snapshots/*.json` (20k file / 25 MiB limits verified) so most anonymous
reads never reach the Worker; personalization stays dynamic.
Rejected: always-on snapshots as primary path (stale like-counts, extra
moving part before it's needed).
