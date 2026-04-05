export type DatabaseMode = "mongo" | "postgres" | "postgres-prefer";

export function getDatabaseMode(): DatabaseMode {
  const raw = (process.env.DB_PROVIDER || process.env.DATABASE_PROVIDER || "mongo").toLowerCase();
  if (raw === "postgres") return "postgres";
  if (raw === "postgres-prefer") return "postgres-prefer";
  return "mongo";
}

export async function runWithDatabasePreference<T>(
  name: string,
  postgresFn: () => Promise<T>,
  mongoFn: () => Promise<T>
) {
  const mode = getDatabaseMode();

  if (mode === "mongo") {
    return mongoFn();
  }

  if (mode === "postgres") {
    return postgresFn();
  }

  try {
    return await postgresFn();
  } catch (error) {
    console.warn(`[data] Falling back to Mongo for ${name}:`, error);
    return mongoFn();
  }
}
