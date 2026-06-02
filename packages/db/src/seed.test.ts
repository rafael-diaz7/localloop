import { eventCategorySchema, eventPriceStatusSchema } from "@localloop/domain";
import { describe, expect, it } from "vitest";

import { seedEvents, seedVenues, validateSeedData } from "./seed";

describe("development seed data", () => {
  it("uses unique stable identifiers", () => {
    const venueIds = new Set(seedVenues.map((venue) => venue.seedId));
    const eventIds = new Set(seedEvents.map((event) => event.sourceId));

    expect(venueIds.size).toBe(seedVenues.length);
    expect(eventIds.size).toBe(seedEvents.length);
  });

  it("uses domain categories and price statuses", () => {
    for (const event of seedEvents) {
      for (const category of event.categories) {
        expect(eventCategorySchema.parse(category)).toBe(category);
      }

      expect(eventPriceStatusSchema.parse(event.priceStatus)).toBe(event.priceStatus);
    }
  });

  it("references seeded venues", () => {
    const venueIds = new Set(seedVenues.map((venue) => venue.seedId));

    for (const event of seedEvents) {
      expect(venueIds.has(event.venueSeedId)).toBe(true);
    }
  });

  it("passes seed validation", () => {
    expect(() => validateSeedData()).not.toThrow();
  });
});
