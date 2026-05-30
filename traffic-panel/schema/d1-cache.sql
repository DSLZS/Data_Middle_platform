CREATE TABLE IF NOT EXISTS api_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  ttl_seconds INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_cache_updated_at
  ON api_cache (updated_at);
