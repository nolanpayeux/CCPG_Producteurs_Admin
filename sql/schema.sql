-- Pilote CCPG : table de travail (sans effet sur le GeoJSON public).
CREATE TABLE IF NOT EXISTS published_features (
  feature_id TEXT PRIMARY KEY,
  feature_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
  feature_id TEXT NOT NULL,
  base_version INTEGER NOT NULL DEFAULT 0,
  before_json TEXT,
  after_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  proposed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status,created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_author ON proposals(proposed_by,created_at);
