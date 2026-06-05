import {
  createDbConnection,
  ensureSource,
  importProviderEventBatch,
  markIngestionRunFailed,
  startIngestionRun
} from "@localloop/db";
import {
  fetchTicketmasterDiscoveryEvents,
  requireTicketmasterApiKey,
  ticketmasterDiscoverySource
} from "@localloop/providers";
import { pathToFileURL } from "node:url";

import { loadNearestEnvFile } from "./env";
import { formatTicketmasterIngestionSummary } from "./ticketmaster-ingestion-summary";

const DEFAULT_RADIUS_MILES = 25;
const DEFAULT_CENTER_LATITUDE = 38.9072;
const DEFAULT_CENTER_LONGITUDE = -77.0369;
const DEFAULT_TIME_WINDOW_DAYS = 30;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_PAGE_SIZE = 100;

export async function ingestTicketmaster() {
  loadNearestEnvFile(import.meta.url);

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to ingest Ticketmaster Discovery events");
  }

  const apiKey = requireTicketmasterApiKey();
  const config = readTicketmasterIngestConfig();
  const requestedAt = new Date();
  const requestedWindowEnd = new Date(
    requestedAt.getTime() + config.timeWindowDays * 24 * 60 * 60 * 1000
  );
  const connection = createDbConnection(databaseUrl);
  let runId: string | undefined;

  try {
    await ensureSource(connection.db, ticketmasterDiscoverySource);

    const run = await startIngestionRun(connection.db, ticketmasterDiscoverySource.key, {
      radiusMiles: config.radiusMiles,
      centerLatitude: config.centerLatitude,
      centerLongitude: config.centerLongitude,
      timeWindowDays: config.timeWindowDays,
      requestedWindowStart: requestedAt.toISOString(),
      requestedWindowEnd: requestedWindowEnd.toISOString(),
      maxPages: config.maxPages,
      pageSize: config.pageSize,
      removalReconciliation: "deferred"
    });
    runId = run.id;

    const batch = await fetchTicketmasterDiscoveryEvents({
      apiKey,
      ...config,
      now: requestedAt
    });
    const result = await importProviderEventBatch(connection.db, batch, runId);

    console.log(
      formatTicketmasterIngestionSummary({
        fetchedCount: batch.fetchedCount,
        importedCount: result.importedCount,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        skippedReasons: batch.skippedReasons,
        expiredCount: result.expiredCount,
        removedCount: result.removedCount,
        removalReconciliation: "deferred"
      })
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

function readTicketmasterIngestConfig() {
  return {
    radiusMiles: positiveIntegerEnv("TICKETMASTER_INGEST_RADIUS_MILES", DEFAULT_RADIUS_MILES),
    centerLatitude: numberEnv("TICKETMASTER_INGEST_CENTER_LATITUDE", DEFAULT_CENTER_LATITUDE),
    centerLongitude: numberEnv("TICKETMASTER_INGEST_CENTER_LONGITUDE", DEFAULT_CENTER_LONGITUDE),
    timeWindowDays: positiveIntegerEnv("TICKETMASTER_INGEST_WINDOW_DAYS", DEFAULT_TIME_WINDOW_DAYS),
    maxPages: positiveIntegerEnv("TICKETMASTER_INGEST_MAX_PAGES", DEFAULT_MAX_PAGES),
    pageSize: positiveIntegerEnv("TICKETMASTER_INGEST_PAGE_SIZE", DEFAULT_PAGE_SIZE)
  };
}

function positiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function numberEnv(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) ? value : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await ingestTicketmaster();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
