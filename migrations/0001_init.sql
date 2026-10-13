-- M0: hello-world schema. Proves migrations pipeline; real tables land in M4.
-- Every table is per-user (owner_id first in every index) and carries
-- updated_at + deleted_at (soft-delete tombstone) for LWW sync.
CREATE TABLE IF NOT EXISTS _m0_ping (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_m0_ping_owner_updated
  ON _m0_ping (owner_id, updated_at);
