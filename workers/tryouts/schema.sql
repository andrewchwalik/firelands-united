CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  envelope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS registrations_pending ON registrations(synced_at, next_attempt);
