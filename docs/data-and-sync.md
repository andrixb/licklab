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
- M1 — no D1 changes. Local Dexie store v1 (`licklab-<namespace>`, compound
  key `[ownerId+id]`, full-Lick JSON + filter columns + tombstones).
- `0002_auth.sql` — accounts milestone: Better Auth tables (`user`, `session`,
  `account`, `verification`; sqlite shapes, epoch-millis dates, indexed by
  `userId`/`token`/`identifier`) + `allowed_email` sign-up gate table. Owned
  by hand, never by ORM codegen.
- `0003_catalog.sql` — M4 community catalog: `lick` (with signatures, visibility,
  license, moderation), `tag`/`lick_tag`, `lick_like`, `favorite`, `pack`/`pack_lick`,
  `report`, `progression`, `user_quota`, `moderation_log`. All indexed for the
  catalog read path and owner-scoped queries. `lick` schemaVersion 2.
- `0004_sync_isolation.sql` — M4 sync isolation: composite primary keys `(id,
  owner_id)` on `lick` so every user has their own ID space; `lick_like`,
  `favorite`, `pack_lick`, `report`, `moderation_log` gain `lick_owner_id` for
  ownership checks and cascading deletes. All indexes rebuilt with `owner_id`
  leading. Sync API (`/api/sync/changes`, `/api/sync/push`) enforces LWW per
  record with server stamps; cross-user isolation tested.

Budget (rows read/written per sync/day, heavy-use scenario) + restore-from-
Time-Travel runbook land in M4. Sync-paused-on-limit state required in client.
