import { describe, expect, it } from "vitest";

import { smithsonianFeedFixture } from "./fixtures";
import {
  buildSmithsonianEventBatch,
  isLikelyDmvSmithsonianEvent,
  mapSmithsonianCategories,
  mapSmithsonianPriceStatus,
  normalizeSmithsonianEvent,
  normalizeSmithsonianProbeEvents,
  parseSmithsonianFeed,
  smithsonianSource,
  summarizeSmithsonianProbeEvents
} from "./index";

describe("Smithsonian Trumba Atom adapter", () => {
  it("parses namespaced Atom entries from the Smithsonian feed", () => {
    const entries = parseSmithsonianFeed(smithsonianFeedFixture);

    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({
      id: "http://uid.trumba.com/event/203523606",
      title: "America's Collections Gallery Talk",
      startTime: "2026-07-12T14:00:00-04:00",
      endTime: "2026-07-12T15:00:00-04:00",
      venue: "National Museum of American History",
      eventLocation: "1300 Constitution Ave NW, Washington, DC 20560",
      categories: ["Gallery Talks & Tours", "Kids & Families"],
      cost: "Free",
      sponsor: "Smithsonian Institution",
      sourceUrl: "https://www.si.edu/events/gallery-talk-fixture",
      registrationUrl: "https://www.si.edu/register/gallery-talk-fixture",
      imageUrl: "https://www.si.edu/images/gallery-talk-fixture.jpg",
      accessibility: "Wheelchair accessible"
    });
  });

  it("normalizes a Smithsonian feed entry into a provider event", () => {
    const [entry] = parseSmithsonianFeed(smithsonianFeedFixture);
    const normalized = normalizeSmithsonianEvent(entry!, new Date("2026-06-05T12:00:00Z"));

    expect(normalized).toMatchObject({
      externalId: "http://uid.trumba.com/event/203523606",
      title: "America's Collections Gallery Talk",
      sourceUrl: "https://www.si.edu/events/gallery-talk-fixture",
      timezone: "America/New_York",
      categories: ["arts-culture", "family"],
      priceStatus: "free",
      status: "active",
      venue: {
        name: "National Museum of American History",
        displayAddress: "1300 Constitution Ave NW, Washington, DC 20560",
        locality: "Washington",
        region: "DC"
      },
      providerMetadata: {
        sponsor: "Smithsonian Institution",
        rawCost: "Free",
        registrationUrl: "https://www.si.edu/register/gallery-talk-fixture",
        imageUrl: "https://www.si.edu/images/gallery-talk-fixture.jpg",
        accessibility: "Wheelchair accessible"
      }
    });
    expect(normalized?.startAt.toISOString()).toBe("2026-07-12T18:00:00.000Z");
    expect(normalized?.endAt?.toISOString()).toBe("2026-07-12T19:00:00.000Z");
  });

  it("maps Smithsonian categories to LocalLoop categories", () => {
    expect(
      mapSmithsonianCategories([
        "Gallery Talks & Tours",
        "Kids & Families",
        "Workshops",
        "Performances",
        "Culinary Arts",
        "After Five"
      ])
    ).toEqual(["arts-culture", "family", "education", "food-drink"]);
    expect(mapSmithsonianCategories(["Unmapped Smithsonian Category"])).toEqual(["other"]);
  });

  it("maps Smithsonian cost text into price status", () => {
    expect(mapSmithsonianPriceStatus("Free registration required")).toBe("free");
    expect(mapSmithsonianPriceStatus("Tickets required. Price: $25")).toBe("paid");
    expect(mapSmithsonianPriceStatus("Registration required")).toBe("paid");
    expect(mapSmithsonianPriceStatus(undefined)).toBe("unknown");
  });

  it("filters out events without a clear DMV location signal", () => {
    const entries = parseSmithsonianFeed(smithsonianFeedFixture);

    expect(isLikelyDmvSmithsonianEvent(entries[0]!)).toBe(true);
    expect(isLikelyDmvSmithsonianEvent(entries[2]!)).toBe(false);
    expect(isLikelyDmvSmithsonianEvent(entries[3]!)).toBe(true);
    expect(
      isLikelyDmvSmithsonianEvent({
        venue: "Smithsonian Castle",
        categories: [],
        rawXml: ""
      })
    ).toBe(true);
  });

  it("builds an import batch with DMV events only and stable provider identity", () => {
    const batch = buildSmithsonianEventBatch(
      smithsonianFeedFixture,
      new Date("2026-06-05T12:00:00Z")
    );

    expect(batch.source).toEqual(smithsonianSource);
    expect(batch.fetchedCount).toBe(4);
    expect(batch.events.map((event) => event.externalId)).toEqual([
      "http://uid.trumba.com/event/203523606",
      "http://uid.trumba.com/event/203523607",
      "http://uid.trumba.com/event/203523609"
    ]);
    expect(batch.skippedCount).toBe(1);
    expect(batch.skippedReasons).toEqual([
      {
        key: "nonDmvLocation",
        label: "Location is not clearly in DC, Maryland, or Virginia",
        count: 1
      }
    ]);
  });

  it("deduplicates repeated feed occurrences by external ID within a batch", () => {
    const duplicateFeed = smithsonianFeedFixture.replace("</feed>", `${entryDuplicate()}</feed>`);
    const batch = buildSmithsonianEventBatch(duplicateFeed, new Date("2026-06-05T12:00:00Z"));

    expect(batch.fetchedCount).toBe(5);
    expect(
      batch.events.filter((event) => event.externalId === "http://uid.trumba.com/event/203523606")
    ).toHaveLength(1);
  });

  it("normalizes probe output and summary without applying the import filter", () => {
    const events = normalizeSmithsonianProbeEvents(smithsonianFeedFixture, 100);
    const summary = summarizeSmithsonianProbeEvents(events);

    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({
      externalId: "http://uid.trumba.com/event/203523606",
      title: "America's Collections Gallery Talk",
      startsAt: "2026-07-12T14:00:00-04:00",
      venue: "National Museum of American History",
      cost: "Free",
      sourceUrl: "https://www.si.edu/events/gallery-talk-fixture"
    });
    expect(summary).toMatchObject({
      totalEvents: 4,
      freeEventCount: 1,
      paidEventCount: 2,
      unknownPricingCount: 1
    });
    expect(summary.categoryCounts["Workshops"]).toBe(2);
    expect(summary.venueCounts["Juneau-Douglas City Museum"]).toBe(1);
  });
});

function entryDuplicate() {
  return `
  <entry>
    <id>http://uid.trumba.com/event/203523606</id>
    <title>America's Collections Gallery Talk Updated</title>
    <link rel="alternate" href="https://www.si.edu/events/gallery-talk-fixture-updated" />
    <gd:when startTime="2026-07-12T14:00:00-04:00" endTime="2026-07-12T15:00:00-04:00" />
    <gc:venue>National Museum of American History</gc:venue>
    <gc:eventlocation>Washington, DC</gc:eventlocation>
    <gc:categories>Gallery Talks &amp; Tours</gc:categories>
    <gc:cost>Free</gc:cost>
  </entry>`;
}
