# Data & sync (D1)

Free-tier facts (re-confirmed Phase 0, Oct 2026): 5M rows read / 100k written
per day (00:00 UTC reset, queries fail when exceeded, enforced since Sep 2026);
10 DBs, 5 GB total, 500 MB/DB; 2 MB max row/string/BLOB; 100 cols/table;
100 bound params/query; 50 queries/Worker invocation; 7-day Time Travel.
Dashboard/Wrangler queries count too. Indexes cost a written row per write.

Design: Dexie is UI source of truth; D1 is synced copy; fully offline-capable.
Each record: `updatedAt` + soft-delete tombstone (`deletedAt`). Push in chunks,
pull `GET /api/changes?since=<cursor>`; LWW per record in domain (pure, tested).
Chunk well under 50 statements / 100 params; per-sync statement-count asserted
in tests (M4). Normalized columns for all filters (owner, function/quality,
artist, difficulty, updatedAt) + indexes; JSON cols for note pattern/chord
context; tag join table. Every filter backed by index (EXPLAIN QUERY PLAN test).
Every query scoped by `owner_id`, index starts with `owner_id`.

## Change log

- `0001_init.sql` — M0 `_m0_ping` smoke table `(id, owner_id, updated_at,
  deleted_at)` + `idx_m0_ping_owner_updated`. Proves migration pipeline.

Budget (rows read/written per sync/day, heavy-use scenario) + restore-from-
Time-Travel runbook land in M4. Sync-paused-on-limit state required in client.
