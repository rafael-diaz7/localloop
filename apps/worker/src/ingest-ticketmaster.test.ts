import { describe, expect, it } from "vitest";

import { formatTicketmasterIngestionSummary } from "./ticketmaster-ingestion-summary";

describe("Ticketmaster ingestion command", () => {
  it("formats skipped event reasons in the ingestion summary", () => {
    expect(
      formatTicketmasterIngestionSummary({
        fetchedCount: 120,
        importedCount: 104,
        skippedCount: 16,
        skippedReasons: [
          {
            key: "missingConcreteStartDateTime",
            label: "Missing concrete start date/time",
            count: 16
          }
        ]
      })
    ).toBe(
      [
        "Ticketmaster ingestion complete.",
        "Fetched: 120",
        "Imported: 104",
        "Skipped: 16",
        "  - Missing concrete start date/time: 16"
      ].join("\n")
    );
  });
});
