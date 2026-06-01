import { describe, expect, it } from "vitest";

import type { EventProvider } from ".";

describe("EventProvider", () => {
  it("defines the provider adapter contract", async () => {
    const provider: EventProvider = {
      id: "fixture",
      displayName: "Fixture Provider",
      searchEvents: async () => []
    };

    await expect(
      provider.searchEvents({ radiusMiles: 10, categories: [], freeOnly: false })
    ).resolves.toEqual([]);
  });
});
