import { describe, expect, it } from "vitest";

import { dmvSearchLocationSlugSchema, getDmvSearchLocation } from "./locations";

describe("DMV search locations", () => {
  it("validates supported location slugs", () => {
    expect(dmvSearchLocationSlugSchema.parse("courthouse-arlington-va")).toBe(
      "courthouse-arlington-va"
    );
    expect(getDmvSearchLocation("dupont-circle-dc").displayName).toBe(
      "Dupont Circle, Washington, DC"
    );
  });

  it("rejects unsupported location slugs", () => {
    expect(() => dmvSearchLocationSlugSchema.parse("rosslyn-va")).toThrow();
    expect(() => dmvSearchLocationSlugSchema.parse("")).toThrow();
  });
});
