import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export const defaultDatabaseUrl = "postgres://localloop:localloop@localhost:5432/localloop";

export function createDbClient(databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl) {
  return createDbConnection(databaseUrl).db;
}

export function createDbConnection(databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a database client");
  }

  const queryClient = postgres(databaseUrl);

  return {
    db: drizzle(queryClient, { schema }),
    close: () => queryClient.end()
  };
}

export type DbClient = ReturnType<typeof createDbClient>;
export type DbConnection = ReturnType<typeof createDbConnection>;
