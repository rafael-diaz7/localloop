import { describe, expect, it } from "vitest";

import {
  formatCategory,
  formatDistanceMiles,
  formatEventPreviewDescription,
  formatEventPrice
} from "./format";

describe("event card formatting", () => {
  it("formats event prices", () => {
    expect(
      formatEventPrice({
        priceStatus: "free",
        minPriceCents: null,
        maxPriceCents: null,
        currency: null
      })
    ).toBe("Free");

    expect(
      formatEventPrice({
        priceStatus: "unknown",
        minPriceCents: null,
        maxPriceCents: null,
        currency: null
      })
    ).toBe("Price unknown");

    expect(
      formatEventPrice({
        priceStatus: "paid",
        minPriceCents: 1800,
        maxPriceCents: 2800,
        currency: "USD"
      })
    ).toBe("$18–$28");
  });

  it("formats category labels", () => {
    expect(formatCategory("food-drink")).toBe("Food and Drink");
    expect(formatCategory("custom")).toBe("custom");
  });

  it("formats distances", () => {
    expect(formatDistanceMiles(0.74)).toBe("0.7 mi away");
    expect(formatDistanceMiles(4.34)).toBe("4.3 mi away");
    expect(formatDistanceMiles(12.2)).toBe("12 mi away");
  });

  it("truncates event preview descriptions on word boundaries", () => {
    const description =
      "Join us for an incredible evening of live music, food vendors, community activities, performances, and more from local artists, neighborhood groups, and visiting makers.";

    expect(formatEventPreviewDescription(description)).toBe(
      "Join us for an incredible evening of live music, food vendors, community activities, performances, and more from local artists, neighborhood groups, and…"
    );
  });

  it("leaves short event preview descriptions unchanged", () => {
    expect(formatEventPreviewDescription("A compact neighborhood market.")).toBe(
      "A compact neighborhood market."
    );
  });
});
