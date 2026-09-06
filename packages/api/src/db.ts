import pg from "pg";
const { Pool } = pg;
export type DbPool = pg.Pool;

export function createDbPool(connectionString: string): DbPool {
  const isRemote =
    !connectionString.includes("localhost") &&
    !connectionString.includes("127.0.0.1");

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  });
}
