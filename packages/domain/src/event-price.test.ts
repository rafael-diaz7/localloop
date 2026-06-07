import { describe, expect, it } from "vitest";

import { formatEventPriceRange } from "./event-price";

describe("formatEventPriceRange", () => {
  it("formats free and unknown prices", () => {
    expect(formatEventPriceRange({ priceStatus: "free" })).toBe("Free");
    expect(formatEventPriceRange({ priceStatus: "unknown" })).toBe("Price unknown");
    expect(formatEventPriceRange({})).toBe("Price unknown");
  });

  it("formats exact prices and ranges", () => {
    expect(
      formatEventPriceRange({
        priceStatus: "paid",
        minPriceCents: 4500,
        maxPriceCents: 4500,
        currency: "USD"
      })
    ).toBe("$45");

    expect(
      formatEventPriceRange({
        priceStatus: "paid",
        minPriceCents: 3500,
        maxPriceCents: 12000,
        currency: "USD"
      })
    ).toBe("$35–$120");
  });

  it("formats partially available ranges", () => {
    expect(
      formatEventPriceRange({
        priceStatus: "paid",
        minPriceCents: 3500,
        maxPriceCents: null,
        currency: "USD"
      })
    ).toBe("From $35");

    expect(
      formatEventPriceRange({
        priceStatus: "paid",
        minPriceCents: null,
        maxPriceCents: 12000,
        currency: "USD"
      })
    ).toBe("Up to $120");
  });

  it("respects currency and keeps needed decimals", () => {
    expect(
      formatEventPriceRange({
        priceStatus: "paid",
        minPriceCents: 1234,
        maxPriceCents: 1234,
        currency: "cad"
      })
    ).toBe("CA$12.34");
  });

  it("handles malformed price data gracefully", () => {
    expect(
      formatEventPriceRange({
        priceStatus: "paid",
        minPriceCents: Number.NaN,
        maxPriceCents: -1,
        currency: "not-a-currency"
      })
    ).toBe("Paid");

    expect(
      formatEventPriceRange({
        priceStatus: "paid",
        minPriceCents: 12000,
        maxPriceCents: 3500,
        currency: "not-a-currency"
      })
    ).toBe("$35–$120");
  });
});
