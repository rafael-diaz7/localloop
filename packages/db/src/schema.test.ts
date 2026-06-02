import { describe, expect, it } from "vitest";

import {
  eventCategoriesTable,
  eventCategoryEnum,
  eventPriceStatusEnum,
  events,
  venues
} from "./schema";

describe("database schema", () => {
  it("defines normalized event tables", () => {
    expect(events).toBeDefined();
    expect(venues).toBeDefined();
    expect(eventCategoriesTable).toBeDefined();
    expect(eventCategoryEnum.enumValues).toContain("community");
    expect(eventPriceStatusEnum.enumValues).toEqual(["free", "paid", "unknown"]);
  });
});
