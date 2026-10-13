-- M4: Community catalog schema. All tables are owner-scoped except
-- public licks (visibility='public') which are readable by anyone.
-- Indexes cover every filtered query path; each query < 100 bound params.

-- lick: main entity with derived signatures + moderation
CREATE TABLE IF NOT EXISTS lick (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pattern TEXT NOT NULL,           -- JSON array of LickNote
  harmonic_context TEXT NOT NULL,  -- JSON {chords, originalKey, function}
  context_key TEXT NOT NULL,
  function_key TEXT NOT NULL,
  chord_quality TEXT,
  pattern_hash TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private','unlisted','public')),
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
  tags TEXT NOT NULL,              -- JSON array
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  notes TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,     -- epoch millis
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,              -- soft-delete tombstone (NULL = alive)
  schema_version INTEGER NOT NULL DEFAULT 2
);

-- Indexes for catalog read path (all queries start with visibility)
CREATE INDEX IF NOT EXISTS idx_lick_vis_ctx ON lick (visibility, context_key);
CREATE INDEX IF NOT EXISTS idx_lick_vis_fn ON lick (visibility, function_key);
CREATE INDEX IF NOT EXISTS idx_lick_vis_q ON lick (visibility, chord_quality);
CREATE INDEX IF NOT EXISTS idx_lick_owner_upd ON lick (owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_lick_owner_del ON lick (owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_lick_mod_state ON lick (moderation_state);

-- tag: normalized tag table (lowercase, trimmed, <=32 chars)
CREATE TABLE IF NOT EXISTS tag (
  id TEXT PRIMARY KEY,             -- normalized tag text (lowercase)
  created_at INTEGER NOT NULL
);

-- lick_tag: many-to-many
CREATE TABLE IF NOT EXISTS lick_tag (
  lick_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (lick_id, tag_id),
  FOREIGN KEY (lick_id) REFERENCES lick(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lick_tag_tag ON lick_tag (tag_id);

-- like: denormalized count is on lick.likes; this table is for audit/unlike
CREATE TABLE IF NOT EXISTS lick_like (
  id TEXT PRIMARY KEY,
  lick_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (lick_id) REFERENCES lick(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lick_like_unique ON lick_like (lick_id, user_id);
CREATE INDEX IF NOT EXISTS idx_lick_like_lick ON lick_like (lick_id);
CREATE INDEX IF NOT EXISTS idx_lick_like_user ON lick_like (user_id);

-- favorite: user-curated personal collection
CREATE TABLE IF NOT EXISTS favorite (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lick_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (lick_id) REFERENCES lick(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorite_unique ON favorite (user_id, lick_id);
CREATE INDEX IF NOT EXISTS idx_favorite_user ON favorite (user_id);

-- pack: user-curated list of licks with visibility
CREATE TABLE IF NOT EXISTS pack (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  short_id TEXT UNIQUE NOT NULL,   -- for share URLs
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pack_owner_upd ON pack (owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_pack_vis ON pack (visibility);

-- pack_lick: ordered contents of a pack
CREATE TABLE IF NOT EXISTS pack_lick (
  pack_id TEXT NOT NULL,
  lick_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (pack_id, lick_id),
  FOREIGN KEY (pack_id) REFERENCES pack(id) ON DELETE CASCADE,
  FOREIGN KEY (lick_id) REFERENCES lick(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pack_lick_pack ON pack_lick (pack_id);

-- report: moderation queue (reporter + target lick + reason)
CREATE TABLE IF NOT EXISTS report (
  id TEXT PRIMARY KEY,
  lick_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,   -- enum: 'copyright','spam','offensive','other'
  comment TEXT,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','dismissed','actioned')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolver_id TEXT,
  FOREIGN KEY (lick_id) REFERENCES lick(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_report_lick ON report (lick_id);
CREATE INDEX IF NOT EXISTS idx_report_state ON report (state);

-- progression: private song/chord progression (owner-only; shareable via URL)
CREATE TABLE IF NOT EXISTS progression (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  composer TEXT,
  key TEXT NOT NULL,
  form TEXT NOT NULL,          -- JSON array of sections {name, bars[{chord,beats}]}
  external_url TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('typed','musicxml','ireal','bundled-example')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_progression_owner_upd ON progression (owner_id, updated_at);

-- per-user quotas & rate limits (enforced in worker + checked here for audit)
CREATE TABLE IF NOT EXISTS user_quota (
  user_id TEXT PRIMARY KEY,
  licks_created_today INTEGER NOT NULL DEFAULT 0,
  favorites_created_today INTEGER NOT NULL DEFAULT 0,
  packs_created_today INTEGER NOT NULL DEFAULT 0,
  sync_changes_today INTEGER NOT NULL DEFAULT 0,
  last_reset_day INTEGER NOT NULL -- epoch day (UTC midnight)
);

-- admin: moderation action log (immutable audit trail)
CREATE TABLE IF NOT EXISTS moderation_log (
  id TEXT PRIMARY KEY,
  moderator_id TEXT NOT NULL,
  target_lick_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'hide','unhide','delete','warn'
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mod_log_lick ON moderation_log (target_lick_id);