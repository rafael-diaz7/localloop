import { describe, expect, it } from "vitest";

import { eventCategoryEnum, events } from "./schema";

describe("database schema", () => {
  it("defines the events table", () => {
    expect(events).toBeDefined();
    expect(eventCategoryEnum.enumValues).toContain("community");
  });
});
