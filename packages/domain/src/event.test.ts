import { describe, expect, it } from "vitest";

import { eventSearchFiltersSchema, localLoopEventSchema } from ".";

describe("eventSearchFiltersSchema", () => {
  it("applies default search filters", () => {
    const filters = eventSearchFiltersSchema.parse({});

    expect(filters.radiusMiles).toBe(10);
    expect(filters.categories).toEqual([]);
    expect(filters.freeOnly).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      eventSearchFiltersSchema.parse({
        startDate: "2026-06-02",
        endDate: "2026-06-01"
      })
    ).toThrow();
  });
});

describe("localLoopEventSchema", () => {
  it("validates a minimal event", () => {
    const event = localLoopEventSchema.parse({
      id: "00000000-0000-4000-8000-000000000000",
      title: "Neighborhood Market",
      startAt: "2026-06-06T14:00:00.000Z",
      category: "community",
      source: "fixture"
    });

    expect(event.title).toBe("Neighborhood Market");
    expect(event.startAt).toBeInstanceOf(Date);
  });
});
