import type { NormalizedEventSkipReason } from "@localloop/providers";

export function formatTicketmasterIngestionSummary(summary: {
  fetchedCount: number;
  importedCount: number;
  skippedCount: number;
  skippedReasons?: NormalizedEventSkipReason[];
}) {
  const lines = [
    "Ticketmaster ingestion complete.",
    `Fetched: ${summary.fetchedCount}`,
    `Imported: ${summary.importedCount}`,
    `Skipped: ${summary.skippedCount}`
  ];

  for (const reason of summary.skippedReasons ?? []) {
    if (reason.count > 0) {
      lines.push(`  - ${reason.label}: ${reason.count}`);
    }
  }

  return lines.join("\n");
}
