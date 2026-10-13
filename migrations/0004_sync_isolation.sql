-- M4: per-user isolation for sync records
-- Add owner_id to primary keys for sync tables to allow per-user ID spaces
-- This migration creates the new schema with composite primary keys.
-- It is idempotent and works for fresh databases (no old tables to migrate).

-- lick: new table with composite primary key (id, owner_id)
CREATE TABLE IF NOT EXISTS lick (
  id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pattern TEXT NOT NULL,
  harmonic_context TEXT NOT NULL,
  context_key TEXT,
  function_key TEXT,
  chord_quality TEXT,
  pattern_hash TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  license TEXT NOT NULL DEFAULT 'CC BY 4.0',
  moderation_state TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_state IN ('pending','approved','hidden','removed')),
  source_artist TEXT,
  source_instrument TEXT,
  source_track TEXT,
  source_album TEXT,
  source_year INTEGER,
  source_recording_url TEXT,
  source_timestamp_seconds INTEGER,
  source_location TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  notes TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 2,
  PRIMARY KEY (id, owner_id)
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_lick_owner_updated ON lick (owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_lick_vis_ctx ON lick (visibility, context_key);
CREATE INDEX IF NOT EXISTS idx_lick_owner_deleted ON lick (owner_id, deleted_at);

-- lick_like: add lick_owner_id for ownership checks
CREATE TABLE IF NOT EXISTS lick_like (
  id TEXT PRIMARY KEY,
  lick_id TEXT NOT NULL,
  lick_owner_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, lick_id, lick_owner_id),
  FOREIGN KEY (lick_id, lick_owner_id) REFERENCES lick(id, owner_id) ON DELETE CASCADE
);

-- favorite: add lick_owner_id
CREATE TABLE IF NOT EXISTS favorite (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lick_id TEXT NOT NULL,
  lick_owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, lick_id, lick_owner_id),
  FOREIGN KEY (lick_id, lick_owner_id) REFERENCES lick(id, owner_id) ON DELETE CASCADE
);

-- pack_lick: add lick_owner_id
CREATE TABLE IF NOT EXISTS pack_lick (
  pack_id TEXT NOT NULL,
  lick_id TEXT NOT NULL,
  lick_owner_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (pack_id, lick_id, lick_owner_id),
  FOREIGN KEY (lick_id, lick_owner_id) REFERENCES lick(id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (pack_id) REFERENCES pack(id) ON DELETE CASCADE
);

-- report: add lick_owner_id
CREATE TABLE IF NOT EXISTS report (
  id TEXT PRIMARY KEY,
  lick_id TEXT NOT NULL,
  lick_owner_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  comment TEXT,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','dismissed','actioned')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolver_id TEXT,
  FOREIGN KEY (lick_id, lick_owner_id) REFERENCES lick(id, owner_id) ON DELETE CASCADE
);

-- moderation_log: add lick_owner_id
CREATE TABLE IF NOT EXISTS moderation_log (
  id TEXT PRIMARY KEY,
  moderator_id TEXT NOT NULL,
  target_lick_id TEXT NOT NULL,
  target_lick_owner_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (target_lick_id, target_lick_owner_id) REFERENCES lick(id, owner_id) ON DELETE CASCADE
);

-- Update the lick upsert in sync repository to include owner_id in ON CONFLICT
-- (handled in application code - see src/adapters/d1/sync.ts)