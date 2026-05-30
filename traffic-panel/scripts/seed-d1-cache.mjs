import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const baseUrl = process.env.PANEL_BASE_URL ?? "http://127.0.0.1:3000";
const outputPath = join(".wrangler", "tmp", "d1-cache-seed.sql");

const entries = [
  ["overview:v1", "/api/overview", 604800],
  ["timeline:v2", "/api/timeline", 604800],
  ["hotspots:v1:5", "/api/hotspots?limit=5", 604800],
  ["hotspots:v1:12", "/api/hotspots?limit=12", 604800],
  ["congested-roads:v1:10", "/api/congested-roads?limit=10", 604800],
  ["road-classes:v1", "/api/road-classes", 604800],
  ["trips:v1:16", "/api/trips?limit=16", 604800],
  ["map-layers:v2", "/api/map-layers", 604800],
];

const now = Date.now();
const statements = [
  `CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    ttl_seconds INTEGER NOT NULL
  );`,
];

for (const [key, path, ttlSeconds] of entries) {
  const response = await fetch(new URL(path, baseUrl));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  const body = await response.json();
  if (!body.success) {
    throw new Error(`Endpoint ${path} returned success=false`);
  }
  const payload = JSON.stringify(body.data).replaceAll("'", "''");
  statements.push(
    `INSERT OR REPLACE INTO api_cache (cache_key, payload, updated_at, ttl_seconds) VALUES ('${key}', '${payload}', ${now}, ${ttlSeconds});`,
  );
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${statements.join("\n\n")}\n`);
console.log(`Wrote ${entries.length} cache entries to ${outputPath}`);
