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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_RADIUS_MILES = 25;
const DEFAULT_TIME_WINDOW_DAYS = 30;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_PAGE_SIZE = 100;

export async function ingestTicketmaster() {
  loadNearestEnvFile();

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to ingest Ticketmaster Discovery events");
  }

  const apiKey = requireTicketmasterApiKey();
  const config = readTicketmasterIngestConfig();
  const connection = createDbConnection(databaseUrl);
  let runId: string | undefined;

  try {
    await ensureSource(connection.db, ticketmasterDiscoverySource);

    const run = await startIngestionRun(connection.db, ticketmasterDiscoverySource.key, {
      radiusMiles: config.radiusMiles,
      timeWindowDays: config.timeWindowDays,
      maxPages: config.maxPages,
      pageSize: config.pageSize
    });
    runId = run.id;

    const batch = await fetchTicketmasterDiscoveryEvents({
      apiKey,
      ...config
    });
    const result = await importProviderEventBatch(connection.db, batch, runId);

    console.log(
      `Imported ${result.importedCount} Ticketmaster events ` +
        `(${batch.fetchedCount} fetched, ${result.skippedCount} skipped).`
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

function loadNearestEnvFile() {
  let directory = dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(directory, ".env");

    if (existsSync(candidate)) {
      loadEnvFile(candidate);
      return;
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return;
    }

    directory = parent;
  }
}

function loadEnvFile(path: string) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
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
