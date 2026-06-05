import { describe, expect, it } from "vitest";

import { formatDeduplicationSummary } from "./dedupe-events";

describe("event deduplication command", () => {
  it("formats summary stats", () => {
    expect(
      formatDeduplicationSummary({
        eventsScanned: 10,
        candidatePairsChecked: 12,
        autoGroupsCreated: 2,
        needsReviewCandidates: 1,
        rejectedIgnoredCandidates: 9,
        addonEventsHidden: 3,
        addonEventsGrouped: 1
      })
    ).toBe(
      [
        "Event deduplication complete.",
        "Events scanned: 10",
        "Candidate pairs checked: 12",
        "Auto groups created: 2",
        "Needs review candidates: 1",
        "Rejected/ignored candidates: 9",
        "Add-on events hidden: 3",
        "Add-on events grouped: 1"
      ].join("\n")
    );
  });
});
