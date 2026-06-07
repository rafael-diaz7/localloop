import { CasingCache } from "drizzle-orm/casing";
import { describe, expect, it } from "vitest";

import type { DbClient } from "./client";
import {
  buildEventDetailSql,
  buildSearchEventsSql,
  getEventDetail,
  searchEvents,
  type SearchEventsInput
} from "./events";

const fixedNow = new Date("2026-06-05T00:00:00.000Z");

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

describe("public event detail query", () => {
  it("only returns active upcoming events", () => {
    const compiled = compileEventDetailSql();

    expect(compiled).toContain("where e.id = $1::uuid");
    expect(compiled).toContain("and e.status = 'active'");
    expect(compiled).toContain("and e.start_at >= $2::timestamptz");
  });

  it("selects joined venue, source, and category data", () => {
    const compiled = compileEventDetailSql();

    expect(compiled).toContain("inner join venues v on e.venue_id = v.id");
    expect(compiled).toContain("left join sources s on e.source = s.key");
    expect(compiled).toContain("left join event_categories ec on e.id = ec.event_id");
    expect(compiled).toContain('v.display_address as "displayAddress"');
    expect(compiled).toContain('s.display_name as "sourceDisplayName"');
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

describe("public event detail results", () => {
  it("maps event detail rows", async () => {
    const event = await getEventDetail(fakeDb([eventRow()]), eventRow().id, fixedNow);

    expect(event).toMatchObject({
      id: "event-1",
      title: "Jazz Night",
      displayAddress: "901 Wharf St SW, Washington, DC",
      categories: ["music"],
      sourceDisplayName: "Smithsonian",
      duplicateCount: 0
    });
  });

  it("returns null when the query finds no active upcoming event", async () => {
    await expect(getEventDetail(fakeDb([]), "event-1", fixedNow)).resolves.toBeNull();
  });
});

function compileEventDetailSql() {
  return buildEventDetailSql("11111111-1111-4111-8111-111111111111", fixedNow).toQuery({
    casing: new CasingCache(),
    escapeName: (name) => `"${name}"`,
    escapeParam: (index) => `$${index + 1}`,
    escapeString: (value) => `'${value}'`,
    prepareTyping: () => "none"
  }).sql;
}

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
    now: fixedNow
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
