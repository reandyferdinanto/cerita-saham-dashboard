import { Pool, type PoolConfig, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __ceritaSahamPostgresPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Please define POSTGRES_URL or DATABASE_URL for Postgres mode");
  }

  const ssl =
    process.env.POSTGRES_SSL === "false"
      ? false
      : { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === "true" };

  const config: PoolConfig = {
    connectionString,
    ssl,
    max: Number(process.env.POSTGRES_MAX_CONNECTIONS || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };

  return new Pool(config);
}

export function getPostgresPool() {
  if (!global.__ceritaSahamPostgresPool) {
    global.__ceritaSahamPostgresPool = createPool();
  }

  return global.__ceritaSahamPostgresPool;
}

export async function queryPostgres<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getPostgresPool().query<T>(text, params);
}
