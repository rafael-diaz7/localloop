import type { NormalizedEventSkipReason } from "@localloop/providers";

export function formatTicketmasterIngestionSummary(summary: {
  fetchedCount: number;
  importedCount: number;
  insertedCount?: number;
  updatedCount?: number;
  skippedCount: number;
  skippedReasons?: NormalizedEventSkipReason[];
  expiredCount?: number;
  removedCount?: number;
  removalReconciliation?: "deferred";
}) {
  const lines = [
    "Ticketmaster ingestion complete.",
    `Fetched: ${summary.fetchedCount}`,
    `Imported: ${summary.importedCount}`,
    `Inserted: ${summary.insertedCount ?? 0}`,
    `Updated: ${summary.updatedCount ?? summary.importedCount}`,
    `Skipped: ${summary.skippedCount}`
  ];

  for (const reason of summary.skippedReasons ?? []) {
    if (reason.count > 0) {
      lines.push(`  - ${reason.label}: ${reason.count}`);
    }
  }

  lines.push(`Expired: ${summary.expiredCount ?? 0}`);
  lines.push(`Removed: ${summary.removedCount ?? 0}`);

  if (summary.removalReconciliation === "deferred") {
    lines.push(
      "Removal reconciliation: deferred; bounded Ticketmaster fetches do not prove absent events were removed."
    );
  }

  return lines.join("\n");
}
