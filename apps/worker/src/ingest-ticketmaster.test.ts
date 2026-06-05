import { describe, expect, it } from "vitest";

import { formatTicketmasterIngestionSummary } from "./ticketmaster-ingestion-summary";

describe("Ticketmaster ingestion command", () => {
  it("formats skipped event reasons in the ingestion summary", () => {
    expect(
      formatTicketmasterIngestionSummary({
        fetchedCount: 120,
        importedCount: 104,
        insertedCount: 80,
        updatedCount: 24,
        skippedCount: 16,
        skippedReasons: [
          {
            key: "missingConcreteStartDateTime",
            label: "Missing concrete start date/time",
            count: 16
          }
        ],
        expiredCount: 3,
        removedCount: 0,
        removalReconciliation: "deferred"
      })
    ).toBe(
      [
        "Ticketmaster ingestion complete.",
        "Fetched: 120",
        "Imported: 104",
        "Inserted: 80",
        "Updated: 24",
        "Skipped: 16",
        "  - Missing concrete start date/time: 16",
        "Expired: 3",
        "Removed: 0",
        "Removal reconciliation: deferred; bounded Ticketmaster fetches do not prove absent events were removed."
      ].join("\n")
    );
  });
});
