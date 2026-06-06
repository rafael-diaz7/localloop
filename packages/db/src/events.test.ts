import { CasingCache } from "drizzle-orm/casing";
import { describe, expect, it } from "vitest";

import type { DbClient } from "./client";
import { buildSearchEventsSql, searchEvents, type SearchEventsInput } from "./events";

describe("public event search query", () => {
  it("displays canonical grouped events instead of duplicate group members", () => {
    const compiled = compileSearchSql();

    expect(compiled).toContain("coalesce(eg.canonical_event_id, e.id) as display_event_id");
    expect(compiled).toContain("group by matched.display_event_id");
    expect(compiled).toContain("inner join events e on display_matches.display_event_id = e.id");
  });

  it("selects deduplication metadata for canonical grouped events", () => {
    const compiled = compileSearchSql();

    expect(compiled).toContain("group_metadata as");
    expect(compiled).toContain("eg.id as group_id");
    expect(compiled).toContain("count(confirmed_egm.event_id)::int as member_count");
    expect(compiled).toContain('gm.group_id as "groupId"');
    expect(compiled).toContain('gm.member_count as "memberCount"');
  });

  it("hides standalone add-on events by default", () => {
    const compiled = compileSearchSql();

    expect(compiled).toContain("hidden_egm.decision = 'rejected'");
    expect(compiled).toContain("hidden_egm.reasons->>'standaloneAddon' = 'true'");
  });
});

describe("public event search results", () => {
  it("returns neutral deduplication metadata for ungrouped events", async () => {
    const [event] = await searchEvents(fakeDb([eventRow()]), searchInput());

    expect(event).toMatchObject({
      id: "event-1",
      groupId: null,
      duplicateCount: 0
    });
  });

  it("returns grouped metadata with duplicate counts beyond the canonical event", async () => {
    const groupId = "11111111-1111-4111-8111-111111111111";
    const results = await searchEvents(
      fakeDb([
        eventRow({
          id: "canonical-event",
          title: "Smithsonian Jazz Night",
          groupId,
          memberCount: 3
        })
      ]),
      searchInput()
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "canonical-event",
      title: "Smithsonian Jazz Night",
      groupId,
      duplicateCount: 2
    });
  });
});

function compileSearchSql() {
  return buildSearchEventsSql(searchInput()).toQuery({
    casing: new CasingCache(),
    escapeName: (name) => `"${name}"`,
    escapeParam: (index) => `$${index + 1}`,
    escapeString: (value) => `'${value}'`,
    prepareTyping: () => "none"
  }).sql;
}

function searchInput(): SearchEventsInput {
  return {
    location: {
      latitude: 38.8904,
      longitude: -77.0869
    },
    radiusMiles: 25,
    dateRange: {
      start: new Date("2026-06-05T00:00:00.000Z"),
      end: new Date("2026-06-12T00:00:00.000Z")
    },
    includedCategories: [],
    excludedCategories: [],
    price: "any",
    sort: "soonest",
    now: new Date("2026-06-05T00:00:00.000Z")
  };
}

function fakeDb(rows: unknown[]) {
  return {
    execute: async () => rows
  } as unknown as DbClient;
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    title: "Jazz Night",
    description: null,
    startAt: new Date("2026-06-06T23:00:00.000Z"),
    endAt: null,
    timezone: "America/New_York",
    venueName: "The Anthem",
    displayAddress: "901 Wharf St SW, Washington, DC",
    locality: "Washington",
    region: "DC",
    categories: ["music"],
    priceStatus: "free",
    minPriceCents: null,
    maxPriceCents: null,
    currency: null,
    sourceUrl: "https://example.com/events/jazz-night",
    sourceKey: "smithsonian",
    sourceDisplayName: "Smithsonian",
    distanceMiles: "1.25",
    groupId: null,
    memberCount: null,
    ...overrides
  };
}
