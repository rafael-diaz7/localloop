import { describe, expect, it } from "vitest";

import { isProviderEventExpired, providerEventExpiresBefore } from "./ingestion";

describe("provider event lifecycle helpers", () => {
  const now = new Date("2026-06-04T12:00:00.000Z");

  it("uses end time as the expiration cutoff when present", () => {
    const event = {
      startAt: new Date("2026-06-04T10:00:00.000Z"),
      endAt: new Date("2026-06-04T13:00:00.000Z")
    };

    expect(providerEventExpiresBefore(event)).toEqual(event.endAt);
    expect(isProviderEventExpired(event, now)).toBe(false);
  });

  it("falls back to start time when no end time exists", () => {
    const event = {
      startAt: new Date("2026-06-04T10:00:00.000Z")
    };

    expect(providerEventExpiresBefore(event)).toEqual(event.startAt);
    expect(isProviderEventExpired(event, now)).toBe(true);
  });
});
