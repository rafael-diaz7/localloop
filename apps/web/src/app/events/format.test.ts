import { describe, expect, it } from "vitest";

import { formatCategory, formatEventPrice } from "./format";

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
    ).toBe("$18-$28");
  });

  it("formats category labels", () => {
    expect(formatCategory("food-drink")).toBe("Food and Drink");
    expect(formatCategory("custom")).toBe("custom");
  });
});
