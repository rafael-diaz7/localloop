import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDbClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a database client");
  }

  const queryClient = postgres(databaseUrl);

  return drizzle(queryClient, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
