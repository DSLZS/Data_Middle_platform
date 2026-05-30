type CloudflareContext = {
  env?: Record<string, unknown>;
};

export type RuntimeBindings = {
  DB?: D1LikeDatabase;
  TRAFFIC_CACHE?: D1LikeDatabase;
  HYPERDRIVE?: { connectionString: string };
  MYSQL_URL?: string;
  MYSQL_USERNAME?: string;
  MYSQL_PASSWORD?: string;
  mysql_url?: string;
  mysql_username?: string;
  mysql_password?: string;
};

export type D1LikeDatabase = {
  exec(sql: string): Promise<unknown>;
  prepare(sql: string): D1LikePreparedStatement;
};

export type D1LikePreparedStatement = {
  bind(...values: unknown[]): D1LikePreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export async function getRuntimeBindings(): Promise<RuntimeBindings> {
  const cloudflare = await getCloudflareBindings();
  const local = await getLocalEnv();

  return {
    ...local,
    ...cloudflare,
  };
}

async function getCloudflareBindings(): Promise<RuntimeBindings> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const getCloudflareContext = mod.getCloudflareContext as unknown as (
      options: { async: true },
    ) => Promise<CloudflareContext>;
    const context = await getCloudflareContext({ async: true });
    return (context.env ?? {}) as RuntimeBindings;
  } catch (error) {
    console.warn(
      "[traffic-panel] Cloudflare bindings unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return {};
  }
}

async function getLocalEnv(): Promise<RuntimeBindings> {
  const direct: RuntimeBindings = {
    MYSQL_URL: process.env.MYSQL_URL,
    MYSQL_USERNAME: process.env.MYSQL_USERNAME,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    mysql_url: process.env.mysql_url,
    mysql_username: process.env.mysql_username,
    mysql_password: process.env.mysql_password,
  };

  if (direct.MYSQL_URL || direct.mysql_url || process.env.NODE_ENV === "production") {
    return direct;
  }

  try {
    const [{ readFile }, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const envPath = path.join(process.cwd(), "..", ".env");
    const content = await readFile(envPath, "utf8");
    return { ...direct, ...parseEnv(content) };
  } catch {
    return direct;
  }
}

function parseEnv(content: string): RuntimeBindings {
  const parsed: Record<string, string> = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed as RuntimeBindings;
}
