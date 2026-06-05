import { describe, expect, it } from "vitest";

import {
  chooseCanonicalEvent,
  eventTitleSimilarity,
  isLikelyAddonEvent,
  normalizeEventTitle,
  scoreDuplicateCandidate,
  venueSimilarity,
  type DuplicateComparisonEvent
} from "./event-deduplication";

const baseEvent = {
  id: "event-1",
  title: "Jazz Night",
  description: null,
  startAt: new Date("2026-06-12T23:00:00.000Z"),
  venueName: "The Anthem",
  locality: "Washington",
  region: "DC",
  categories: ["music"]
} satisfies DuplicateComparisonEvent;

describe("event deduplication helpers", () => {
  it("normalizes event titles", () => {
    expect(normalizeEventTitle("  Jazz Night: VIP Package!! ")).toBe("jazz night");
  });

  it("detects obvious add-on events", () => {
    expect(isLikelyAddonEvent("Jazz Night Parking")).toBe(true);
    expect(isLikelyAddonEvent("Jazz Night", "Fast Lane upgrade available")).toBe(true);
    expect(isLikelyAddonEvent("Jazz Night")).toBe(false);
  });

  it("scores high title and venue similarity deterministically", () => {
    expect(eventTitleSimilarity("Jazz Night", "Jazz Night - Official Platinum")).toBe(1);
    expect(venueSimilarity("The Anthem", "Anthem")).toBeGreaterThanOrEqual(0.5);
  });

  it("auto-groups strong duplicate candidates", () => {
    const result = scoreDuplicateCandidate(baseEvent, {
      ...baseEvent,
      id: "event-2",
      title: "Jazz Night!",
      startAt: new Date("2026-06-12T23:30:00.000Z")
    });

    expect(result.decision).toBe("auto_group");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("marks borderline candidates as needing review", () => {
    const result = scoreDuplicateCandidate(baseEvent, {
      ...baseEvent,
      id: "event-2",
      title: "Jazz Night",
      venueName: "9:30 Club",
      categories: ["arts-culture"]
    });

    expect(result.decision).toBe("needs_review");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(80);
  });

  it("rejects weak candidates below the threshold", () => {
    const result = scoreDuplicateCandidate(baseEvent, {
      ...baseEvent,
      id: "event-2",
      title: "Matinee Craft Workshop",
      startAt: new Date("2026-06-13T18:00:00.000Z"),
      categories: ["education"]
    });

    expect(result.decision).toBe("rejected");
    expect(result.score).toBeLessThan(60);
  });

  it("can confidently group parent events with matching add-ons", () => {
    const result = scoreDuplicateCandidate(baseEvent, {
      ...baseEvent,
      id: "event-2",
      title: "Jazz Night Parking"
    });

    expect(result.decision).toBe("auto_group");
    expect(result.reasons).toContain("addon_parent_title_match");
  });

  it("chooses a non-add-on canonical event with stronger source priority", () => {
    const canonical = chooseCanonicalEvent([
      {
        ...baseEvent,
        id: "ticketmaster-addon",
        title: "Jazz Night VIP Package",
        source: "ticketmaster-discovery",
        sourceUrl: "https://ticketmaster.example/event",
        createdAt: new Date("2026-06-01T00:00:00.000Z")
      },
      {
        ...baseEvent,
        id: "smithsonian-parent",
        source: "smithsonian",
        sourceUrl: "https://smithsonian.example/event",
        createdAt: new Date("2026-06-02T00:00:00.000Z")
      }
    ]);

    expect(canonical.id).toBe("smithsonian-parent");
  });
});
