import { describe, expect, it } from "vitest";

import {
  eventCategorySetMatchesFilters,
  parseEventSearchParams,
  resolveCustomDateRange,
  resolveDatePresetRange,
  serializeEventSearchParams
} from "./event-search";

describe("event URL search parameters", () => {
  const now = new Date("2026-06-04T16:00:00Z");

  it("falls back to defaults for missing or invalid values", () => {
    const parsed = parseEventSearchParams(
      {
        near: "unknown-place",
        radius: "2",
        date: "next-year",
        include: "music,nope,food-drink",
        exclude: "sports-fitness,also-nope",
        price: "cheap",
        sort: "popular"
      },
      now
    );

    expect(parsed.filters).toMatchObject({
      near: "courthouse-arlington-va",
      radius: 10,
      date: "next-7-days",
      include: ["music", "food-drink"],
      exclude: ["sports-fitness"],
      price: "any",
      sort: "soonest"
    });
    expect(parsed.ignoredParams).toEqual([
      "near",
      "radius",
      "date",
      "include",
      "exclude",
      "price",
      "sort"
    ]);
  });

  it("parses supported radius, price, sort, and repeated category parameters", () => {
    const params = new URLSearchParams();
    params.set("radius", "25");
    params.set("price", "free");
    params.set("sort", "closest");
    params.append("include", "music");
    params.append("include", "community,education");

    const parsed = parseEventSearchParams(params, now);

    expect(parsed.filters.radius).toBe(25);
    expect(parsed.filters.price).toBe("free");
    expect(parsed.filters.sort).toBe("closest");
    expect(parsed.filters.include).toEqual(["music", "community", "education"]);
  });

  it("serializes query parameters deterministically", () => {
    const parsed = parseEventSearchParams(
      {
        near: "dupont-circle-dc",
        radius: "3",
        date: "custom",
        from: "2026-06-06",
        to: "2026-06-07",
        include: "music,community",
        exclude: "sports-fitness",
        price: "paid",
        sort: "closest"
      },
      now
    );

    expect(serializeEventSearchParams(parsed.filters)).toBe(
      "near=dupont-circle-dc&radius=3&date=custom&from=2026-06-06&to=2026-06-07&include=music%2Ccommunity&exclude=sports-fitness&price=paid&sort=closest"
    );
  });
});

describe("event date windows", () => {
  it("resolves today using DMV day boundaries", () => {
    const range = resolveDatePresetRange("today", new Date("2026-06-04T16:00:00Z"));

    expect(range.start.toISOString()).toBe("2026-06-04T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-06-05T04:00:00.000Z");
  });

  it("resolves tomorrow", () => {
    const range = resolveDatePresetRange("tomorrow", new Date("2026-06-04T16:00:00Z"));

    expect(range.start.toISOString()).toBe("2026-06-05T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-06-06T04:00:00.000Z");
  });

  it("resolves this weekend from a weekday", () => {
    const range = resolveDatePresetRange("weekend", new Date("2026-06-04T16:00:00Z"));

    expect(range.start.toISOString()).toBe("2026-06-06T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-06-08T04:00:00.000Z");
  });

  it("resolves this weekend during a Friday transition", () => {
    const range = resolveDatePresetRange("weekend", new Date("2026-06-06T02:30:00Z"));

    expect(range.start.toISOString()).toBe("2026-06-06T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-06-08T04:00:00.000Z");
  });

  it("resolves next 7 days", () => {
    const range = resolveDatePresetRange("next-7-days", new Date("2026-06-04T16:00:00Z"));

    expect(range.start.toISOString()).toBe("2026-06-04T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-06-11T04:00:00.000Z");
  });

  it("resolves valid custom ranges", () => {
    const range = resolveCustomDateRange("2026-06-06", "2026-06-07");

    expect(range?.start.toISOString()).toBe("2026-06-06T04:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-06-08T04:00:00.000Z");
  });

  it("rejects invalid custom ranges", () => {
    expect(resolveCustomDateRange("2026-06-08", "2026-06-07")).toBeNull();
    expect(resolveCustomDateRange("2026-06-08", "")).toBeNull();
    expect(resolveCustomDateRange("2026-02-31", "2026-03-01")).toBeNull();
  });
});

describe("event category include and exclude rules", () => {
  it("allows all categories except excluded categories when no include is selected", () => {
    expect(eventCategorySetMatchesFilters(["other"], [], ["sports-fitness"])).toBe(true);
    expect(eventCategorySetMatchesFilters(["sports-fitness"], [], ["sports-fitness"])).toBe(false);
  });

  it("requires included categories and lets exclusions win", () => {
    expect(eventCategorySetMatchesFilters(["music"], ["music"], [])).toBe(true);
    expect(eventCategorySetMatchesFilters(["other"], ["music"], [])).toBe(false);
    expect(
      eventCategorySetMatchesFilters(["music", "sports-fitness"], ["music"], ["sports-fitness"])
    ).toBe(false);
  });
});
