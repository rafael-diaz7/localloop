import { CasingCache } from "drizzle-orm/casing";
import { describe, expect, it } from "vitest";

import { buildSearchEventsSql } from "./events";

describe("public event search query", () => {
  it("displays canonical grouped events instead of duplicate group members", () => {
    const compiled = compileSearchSql();

    expect(compiled).toContain("coalesce(eg.canonical_event_id, e.id) as display_event_id");
    expect(compiled).toContain("group by matched.display_event_id");
    expect(compiled).toContain("inner join events e on display_matches.display_event_id = e.id");
  });

  it("hides standalone add-on events by default", () => {
    const compiled = compileSearchSql();

    expect(compiled).toContain("hidden_egm.decision = 'rejected'");
    expect(compiled).toContain("hidden_egm.reasons->>'standaloneAddon' = 'true'");
  });
});

function compileSearchSql() {
  return buildSearchEventsSql({
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
  }).toQuery({
    casing: new CasingCache(),
    escapeName: (name) => `"${name}"`,
    escapeParam: (index) => `$${index + 1}`,
    escapeString: (value) => `'${value}'`,
    prepareTyping: () => "none"
  }).sql;
}
