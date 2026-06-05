import { describe, expect, it } from "vitest";

import {
  eventCategoriesTable,
  eventCategoryEnum,
  eventPriceStatusEnum,
  eventStatusEnum,
  events,
  ingestionRunStatusEnum,
  ingestionRuns,
  rawSourceEvents,
  sources,
  venues
} from "./schema";

describe("database schema", () => {
  it("defines normalized event tables", () => {
    expect(events).toBeDefined();
    expect(venues).toBeDefined();
    expect(sources).toBeDefined();
    expect(ingestionRuns).toBeDefined();
    expect(rawSourceEvents).toBeDefined();
    expect(eventCategoriesTable).toBeDefined();
    expect(eventCategoryEnum.enumValues).toContain("community");
    expect(eventPriceStatusEnum.enumValues).toEqual(["free", "paid", "unknown"]);
    expect(eventStatusEnum.enumValues).toEqual(["active", "cancelled", "expired"]);
    expect(ingestionRunStatusEnum.enumValues).toEqual(["running", "succeeded", "failed"]);
  });
});
