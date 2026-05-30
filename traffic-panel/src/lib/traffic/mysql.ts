import mysql from "mysql2/promise";

import { getRuntimeBindings } from "./runtime";

type MysqlConfig = {
  uri?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
};

export async function queryRows<T extends object>(
  sql: string,
  params: Array<string | number | boolean | null> = [],
): Promise<T[]> {
  const config = await getMysqlConfig();
  if (!config) throw new Error("MySQL connection is not configured");

  const connection = config.uri
    ? await mysql.createConnection(config.uri)
    : await mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        connectTimeout: 10000,
        dateStrings: true,
      });

  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T[];
  } finally {
    await connection.end();
  }
}

async function getMysqlConfig(): Promise<MysqlConfig | null> {
  const bindings = await getRuntimeBindings();
  if (bindings.HYPERDRIVE?.connectionString) {
    return { uri: bindings.HYPERDRIVE.connectionString };
  }

  const rawUrl = String(bindings.MYSQL_URL ?? bindings.mysql_url ?? "");
  if (!rawUrl) return null;

  const user = String(bindings.MYSQL_USERNAME ?? bindings.mysql_username ?? "");
  const password = String(bindings.MYSQL_PASSWORD ?? bindings.mysql_password ?? "");
  const url = new URL(rawUrl.replace(/^jdbc:/, ""));

  if (url.username && url.password) {
    return { uri: url.toString() };
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    database: url.pathname.replace(/^\//, ""),
    user,
    password,
  };
}
