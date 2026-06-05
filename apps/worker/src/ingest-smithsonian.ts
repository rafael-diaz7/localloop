import {
  createDbConnection,
  ensureSource,
  importProviderEventBatch,
  markIngestionRunFailed,
  startIngestionRun
} from "@localloop/db";
import {
  fetchSmithsonianEvents,
  SMITHSONIAN_EVENTS_FEED_URL,
  smithsonianSource
} from "@localloop/providers";
import { pathToFileURL } from "node:url";

import { loadNearestEnvFile } from "./env";

export async function ingestSmithsonian() {
  loadNearestEnvFile(import.meta.url);

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to ingest Smithsonian events");
  }

  const requestedAt = new Date();
  const connection = createDbConnection(databaseUrl);
  let runId: string | undefined;

  try {
    await ensureSource(connection.db, smithsonianSource);

    const run = await startIngestionRun(connection.db, smithsonianSource.key, {
      endpoint: SMITHSONIAN_EVENTS_FEED_URL,
      requestedAt: requestedAt.toISOString(),
      removalReconciliation: "deferred",
      dmvFilter:
        "Imports only events whose venue, event location, or gd:where text contains a clear DC, Maryland, Virginia, or known DMV Smithsonian venue signal."
    });
    runId = run.id;

    const batch = await fetchSmithsonianEvents({
      now: requestedAt
    });
    const result = await importProviderEventBatch(connection.db, batch, runId);

    console.log(
      JSON.stringify(
        {
          source: smithsonianSource.key,
          fetchedCount: batch.fetchedCount,
          importedCount: result.importedCount,
          insertedCount: result.insertedCount,
          updatedCount: result.updatedCount,
          skippedCount: result.skippedCount,
          skippedReasons: batch.skippedReasons,
          expiredCount: result.expiredCount,
          removedCount: result.removedCount,
          removalReconciliation: "deferred"
        },
        null,
        2
      )
    );

    return result;
  } catch (error) {
    if (runId) {
      await markIngestionRunFailed(connection.db, runId, errorMessage(error));
    }

    throw error;
  } finally {
    await connection.close();
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await ingestSmithsonian();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
