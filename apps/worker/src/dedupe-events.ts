import { createDbConnection, recomputeEventDeduplication } from "@localloop/db";
import { pathToFileURL } from "node:url";

import { loadNearestEnvFile } from "./env";

export async function dedupeEvents() {
  loadNearestEnvFile(import.meta.url);

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to deduplicate events");
  }

  const connection = createDbConnection(databaseUrl);

  try {
    const summary = await recomputeEventDeduplication(connection.db);

    console.log(formatDeduplicationSummary(summary));

    return summary;
  } finally {
    await connection.close();
  }
}

export function formatDeduplicationSummary(summary: {
  eventsScanned: number;
  candidatePairsChecked: number;
  autoGroupsCreated: number;
  needsReviewCandidates: number;
  rejectedIgnoredCandidates: number;
  addonEventsHidden: number;
  addonEventsGrouped: number;
}) {
  return [
    "Event deduplication complete.",
    `Events scanned: ${summary.eventsScanned}`,
    `Candidate pairs checked: ${summary.candidatePairsChecked}`,
    `Auto groups created: ${summary.autoGroupsCreated}`,
    `Needs review candidates: ${summary.needsReviewCandidates}`,
    `Rejected/ignored candidates: ${summary.rejectedIgnoredCandidates}`,
    `Add-on events hidden: ${summary.addonEventsHidden}`,
    `Add-on events grouped: ${summary.addonEventsGrouped}`
  ].join("\n");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await dedupeEvents();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
