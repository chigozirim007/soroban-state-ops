import pg from "pg";
const { Pool } = pg;
export type DbPool = pg.Pool;

export function createDbPool(connectionString: string): DbPool {
  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
