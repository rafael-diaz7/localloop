import { createDbConnection, listRecentIngestionRuns } from "@localloop/db";
import { pathToFileURL } from "node:url";

import { loadNearestEnvFile } from "./env";

const DEFAULT_LIMIT = 5;

type IngestionRunMetadata = {
  lifecycle?: {
    insertedCount?: number;
    updatedCount?: number;
    expiredCount?: number;
    removedCount?: number;
    removalReconciliation?: string;
  };
  fetchCoverage?: {
    pagesFetched?: number;
    providerTotalPages?: number;
    completedConfiguredFetchScope?: boolean;
  };
};

export async function printIngestionStatus(limit = DEFAULT_LIMIT) {
  loadNearestEnvFile(import.meta.url);

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to inspect ingestion status");
  }

  const connection = createDbConnection(databaseUrl);

  try {
    const rows = await listRecentIngestionRuns(connection.db, limit);

    if (rows.length === 0) {
      console.log("No ingestion runs found.");
      return;
    }

    console.log(`Latest ingestion runs (${rows.length}):`);

    for (const row of rows) {
      const metadata = row.metadata as IngestionRunMetadata | null;
      const lifecycle = metadata?.lifecycle;
      const coverage = metadata?.fetchCoverage;

      console.log(
        [
          `${row.startedAt.toISOString()} ${row.source} ${row.status}`,
          `  fetched=${row.fetchedCount} imported=${row.importedCount} skipped=${row.skippedCount}`,
          `  inserted=${lifecycle?.insertedCount ?? 0} updated=${lifecycle?.updatedCount ?? row.importedCount} expired=${lifecycle?.expiredCount ?? 0} removed=${lifecycle?.removedCount ?? 0}`,
          `  fetchScopeCompleted=${coverage?.completedConfiguredFetchScope ?? "unknown"} pages=${coverage?.pagesFetched ?? "unknown"}/${coverage?.providerTotalPages ?? "unknown"}`,
          `  removalReconciliation=${lifecycle?.removalReconciliation ?? "unknown"}`
        ].join("\n")
      );

      if (row.errorMessage) {
        console.log(`  error=${row.errorMessage}`);
      }
    }
  } finally {
    await connection.close();
  }
}

function positiveLimit(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await printIngestionStatus(positiveLimit(process.argv[2]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
