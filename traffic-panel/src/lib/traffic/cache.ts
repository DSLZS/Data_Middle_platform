import { getRuntimeBindings } from "./runtime";

type CacheEntry<T> = {
  payload: T;
  updatedAt: number;
  ttlSeconds: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<{ data: T; source: "cache" | "database" | "fallback" }> {
  const d1 = await getD1();
  if (d1) {
    await ensureCacheTable(d1);
    const cached = await d1
      .prepare("SELECT payload, updated_at, ttl_seconds FROM api_cache WHERE cache_key = ?")
      .bind(key)
      .first<{ payload: string; updated_at: number; ttl_seconds: number }>();

    if (cached && Date.now() - cached.updated_at < cached.ttl_seconds * 1000) {
      return { data: JSON.parse(cached.payload) as T, source: "cache" };
    }

    const produced = await producer();
    await d1
      .prepare(
        "INSERT OR REPLACE INTO api_cache (cache_key, payload, updated_at, ttl_seconds) VALUES (?, ?, ?, ?)",
      )
      .bind(key, JSON.stringify(produced), Date.now(), ttlSeconds)
      .run();
    return { data: produced, source: "database" };
  }

  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (cached && Date.now() - cached.updatedAt < cached.ttlSeconds * 1000) {
    return { data: cached.payload, source: "cache" };
  }

  const produced = await producer();
  memoryCache.set(key, {
    payload: produced,
    updatedAt: Date.now(),
    ttlSeconds,
  });
  return { data: produced, source: "database" };
}

async function getD1() {
  const bindings = await getRuntimeBindings();
  return bindings.TRAFFIC_CACHE ?? bindings.DB ?? null;
}

async function ensureCacheTable(db: NonNullable<Awaited<ReturnType<typeof getD1>>>) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS api_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL, ttl_seconds INTEGER NOT NULL);",
  );
}
