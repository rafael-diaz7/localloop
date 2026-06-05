import { describe, expect, it } from "vitest";

import {
  incompleteVenueTicketmasterResponse,
  missingPriceTicketmasterResponse,
  typicalTicketmasterResponse,
  unknownClassificationTicketmasterResponse
} from "./ticketmaster-discovery.fixtures";
import {
  buildTicketmasterDiscoveryUrl,
  fetchTicketmasterDiscoveryEvents,
  getTicketmasterEventSkipReason,
  mapTicketmasterClassifications,
  normalizeTicketmasterEvent,
  parseTicketmasterDiscoveryResponse,
  requireTicketmasterApiKey
} from "./ticketmaster-discovery";

describe("Ticketmaster Discovery adapter", () => {
  it("validates a Discovery API response", () => {
    const parsed = parseTicketmasterDiscoveryResponse(typicalTicketmasterResponse);

    expect(parsed._embedded?.events?.[0]?.id).toBe("tm-typical-1");
  });

  it("normalizes a typical Ticketmaster event", () => {
    const parsed = parseTicketmasterDiscoveryResponse(typicalTicketmasterResponse);
    const event = parsed._embedded?.events?.[0];

    expect(event).toBeDefined();

    const normalized = normalizeTicketmasterEvent(event!);

    expect(normalized).toMatchObject({
      externalId: "tm-typical-1",
      title: "Sanitized Arena Concert",
      sourceUrl: "https://www.ticketmaster.com/sanitized-arena-concert/event/tm-typical-1",
      timezone: "America/New_York",
      categories: ["music"],
      priceStatus: "paid",
      minPriceCents: 3500,
      maxPriceCents: 9550,
      currency: "USD",
      status: "active",
      venue: {
        externalId: "tm-venue-1",
        name: "Fixture Arena",
        displayAddress: "700 Fixture Ave",
        locality: "Washington",
        region: "DC",
        postalCode: "20001",
        latitude: 38.9,
        longitude: -77.02
      }
    });
    expect(normalized?.startAt.toISOString()).toBe("2026-07-10T23:30:00.000Z");
    expect(normalized?.endAt?.toISOString()).toBe("2026-07-11T02:30:00.000Z");
  });

  it("strips image fields from raw payload snapshots", () => {
    const parsed = parseTicketmasterDiscoveryResponse(typicalTicketmasterResponse);
    const event = parsed._embedded?.events?.[0];
    const normalized = normalizeTicketmasterEvent(event!);

    expect(JSON.stringify(normalized?.rawPayload?.payload)).not.toContain("images");
    expect(JSON.stringify(normalized?.rawPayload?.payload)).not.toContain("ticketmaster-image");
  });

  it("maps missing price information to unknown", () => {
    const parsed = parseTicketmasterDiscoveryResponse(missingPriceTicketmasterResponse);
    const event = parsed._embedded?.events?.[0];
    const normalized = normalizeTicketmasterEvent(event!);

    expect(normalized?.priceStatus).toBe("unknown");
    expect(normalized?.minPriceCents).toBeUndefined();
    expect(normalized?.maxPriceCents).toBeUndefined();
  });

  it("maps unknown classifications to Other", () => {
    const parsed = parseTicketmasterDiscoveryResponse(unknownClassificationTicketmasterResponse);
    const event = parsed._embedded?.events?.[0];
    const normalized = normalizeTicketmasterEvent(event!);

    expect(normalized?.categories).toEqual(["other"]);
    expect(
      mapTicketmasterClassifications([
        {
          segment: {
            name: "Sports"
          }
        }
      ])
    ).toEqual(["sports-fitness"]);
  });

  it("handles incomplete optional venue fields", () => {
    const parsed = parseTicketmasterDiscoveryResponse(incompleteVenueTicketmasterResponse);
    const event = parsed._embedded?.events?.[0];
    const normalized = normalizeTicketmasterEvent(event!);

    expect(normalized?.venue).toEqual({
      externalId: "tm-venue-4",
      name: "Fixture Minimal Venue",
      displayAddress: undefined,
      locality: undefined,
      region: undefined,
      postalCode: undefined,
      latitude: undefined,
      longitude: undefined
    });
  });

  it("keeps the provider external ID stable", () => {
    const parsed = parseTicketmasterDiscoveryResponse(typicalTicketmasterResponse);
    const event = parsed._embedded?.events?.[0];

    expect(normalizeTicketmasterEvent(event!)?.externalId).toBe("tm-typical-1");
  });

  it("tracks events skipped because they are missing a concrete start date/time", async () => {
    const parsed = parseTicketmasterDiscoveryResponse(typicalTicketmasterResponse);
    const validEvent = parsed._embedded?.events?.[0];

    expect(validEvent).toBeDefined();

    if (!validEvent) {
      throw new Error("Expected a valid Ticketmaster fixture event");
    }

    const missingDateTimeEvent = structuredClone(validEvent);

    if (!missingDateTimeEvent.dates.start) {
      throw new Error("Expected a valid Ticketmaster fixture event start");
    }

    delete missingDateTimeEvent.dates.start.dateTime;
    missingDateTimeEvent.id = "tm-missing-concrete-start-1";
    missingDateTimeEvent.name = "Sanitized Event Missing Concrete Start";

    expect(
      getTicketmasterEventSkipReason(
        parseTicketmasterDiscoveryResponse({ _embedded: { events: [missingDateTimeEvent] } })
          ._embedded!.events![0]!
      )
    ).toMatchObject({
      key: "missingConcreteStartDateTime",
      label: "Missing concrete start date/time"
    });

    const batch = await fetchTicketmasterDiscoveryEvents({
      apiKey: "test-key",
      maxPages: 1,
      now: new Date("2026-06-02T12:00:00Z"),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          _embedded: {
            events: [validEvent, missingDateTimeEvent]
          },
          page: {
            size: 100,
            totalElements: 2,
            totalPages: 1,
            number: 0
          }
        })
      })
    });

    expect(batch.fetchedCount).toBe(2);
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]?.externalId).toBe("tm-typical-1");
    expect(batch.skippedCount).toBe(1);
    expect(batch.skippedReasons).toEqual([
      {
        key: "missingConcreteStartDateTime",
        label: "Missing concrete start date/time",
        count: 1
      }
    ]);
  });

  it("records incomplete bounded fetch coverage without implying provider removals", async () => {
    const parsed = parseTicketmasterDiscoveryResponse(typicalTicketmasterResponse);
    const validEvent = parsed._embedded?.events?.[0];

    expect(validEvent).toBeDefined();

    if (!validEvent) {
      throw new Error("Expected a valid Ticketmaster fixture event");
    }

    const batch = await fetchTicketmasterDiscoveryEvents({
      apiKey: "test-key",
      maxPages: 1,
      now: new Date("2026-06-02T12:00:00Z"),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          _embedded: {
            events: [validEvent]
          },
          page: {
            size: 100,
            totalElements: 250,
            totalPages: 3,
            number: 0
          }
        })
      })
    });

    expect(batch.metadata).toMatchObject({
      requestedWindowStart: "2026-06-02T12:00:00Z",
      requestedWindowEnd: "2026-07-02T12:00:00Z",
      fetchCoverage: {
        pagesFetched: 1,
        lastPageFetched: 0,
        providerTotalPages: 3,
        providerTotalElements: 250,
        completedConfiguredFetchScope: false
      }
    });
  });

  it("throws a useful error when the API key is missing", () => {
    expect(() => requireTicketmasterApiKey({})).toThrow("TICKETMASTER_API_KEY is required");
  });

  it("builds bounded DMV geoPoint search parameters without exposing the key in metadata", () => {
    const url = buildTicketmasterDiscoveryUrl({
      apiKey: "test-key",
      radiusMiles: 25,
      centerLatitude: 38.9072,
      centerLongitude: -77.0369,
      timeWindowDays: 30,
      pageSize: 100,
      page: 0,
      now: new Date("2026-06-02T12:00:00Z")
    });

    expect(url.searchParams.get("geoPoint")).toBeTruthy();
    expect(url.searchParams.get("radius")).toBe("25");
    expect(url.searchParams.get("unit")).toBe("miles");
    expect(url.searchParams.get("countryCode")).toBe("US");
    expect(url.searchParams.get("startDateTime")).toBe("2026-06-02T12:00:00Z");
    expect(url.searchParams.get("endDateTime")).toBe("2026-07-02T12:00:00Z");
    expect(url.searchParams.get("sort")).toBe("date,asc");
    expect(url.searchParams.get("page")).toBe("0");
  });
});
