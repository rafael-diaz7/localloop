import { describe, expect, it } from "vitest";

import { NominatimGeocoder } from "./geocoding";

describe("Nominatim geocoder", () => {
  it("returns successful geocoding candidates", async () => {
    let requestedQuery = "";
    let requestedUserAgent = "";
    const geocoder = new NominatimGeocoder({
      userAgent: "LocalLoop tests",
      fetchImpl: async (input, init) => {
        requestedQuery = new URL(String(input)).searchParams.get("q") ?? "";
        requestedUserAgent = String(init?.headers?.["User-Agent" as never]);

        return new Response(
          JSON.stringify([
            {
              place_id: 123,
              display_name: "Courthouse, Arlington, VA, United States",
              lat: "38.8904",
              lon: "-77.0869",
              address: {
                neighbourhood: "Courthouse",
                county: "Arlington County",
                state: "Virginia",
                country_code: "us"
              }
            }
          ]),
          { status: 200 }
        );
      }
    });

    await expect(geocoder.search("Courthouse Arlington")).resolves.toEqual([
      {
        id: "123",
        displayName: "Courthouse, Arlington County, VA",
        latitude: 38.8904,
        longitude: -77.0869,
        provider: "nominatim",
        locality: "Courthouse",
        region: "VA"
      }
    ]);
    expect(requestedQuery).toBe("Courthouse Arlington");
    expect(requestedUserAgent).toBe("LocalLoop tests");
  });

  it("filters out non-US geocoding candidates", async () => {
    const geocoder = new NominatimGeocoder({
      userAgent: "LocalLoop tests",
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              place_id: 1,
              display_name: "Arlington, Texas, United States",
              lat: "32.7357",
              lon: "-97.1081",
              address: {
                city: "Arlington",
                state: "Texas",
                country_code: "us"
              }
            },
            {
              place_id: 2,
              display_name: "Arlington, Devon, United Kingdom",
              lat: "51.148",
              lon: "-3.984",
              address: {
                village: "Arlington",
                country_code: "gb"
              }
            }
          ]),
          { status: 200 }
        )
    });

    await expect(geocoder.search("Arlington")).resolves.toEqual([
      {
        id: "1",
        displayName: "Arlington, TX",
        latitude: 32.7357,
        longitude: -97.1081,
        provider: "nominatim",
        locality: "Arlington",
        region: "TX"
      }
    ]);
  });

  it("accepts US city and state candidates and prefers DMV results", async () => {
    const geocoder = new NominatimGeocoder({
      userAgent: "LocalLoop tests",
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              place_id: 1,
              display_name: "Woodbridge, New Jersey, United States",
              lat: "40.5576",
              lon: "-74.2846",
              address: {
                town: "Woodbridge",
                state: "New Jersey",
                country_code: "us"
              }
            },
            {
              place_id: 2,
              display_name: "Woodbridge, Prince William County, Virginia, United States",
              lat: "38.6582",
              lon: "-77.2497",
              address: {
                town: "Woodbridge",
                county: "Prince William County",
                state: "Virginia",
                country_code: "us"
              }
            }
          ]),
          { status: 200 }
        )
    });

    const results = await geocoder.search("Woodbridge, VA");

    expect(results[0]).toMatchObject({
      displayName: "Woodbridge, Prince William County, VA",
      latitude: 38.6582,
      longitude: -77.2497,
      locality: "Woodbridge",
      region: "VA"
    });
  });

  it("uses US structured postal code lookup for ZIP-like searches", async () => {
    let requestedUrl: URL | undefined;
    const geocoder = new NominatimGeocoder({
      userAgent: "LocalLoop tests",
      fetchImpl: async (input) => {
        requestedUrl = new URL(String(input));

        return new Response(
          JSON.stringify([
            {
              place_id: 22191,
              display_name: "22191, Woodbridge, Virginia, United States",
              lat: "38.6326",
              lon: "-77.2644",
              address: {
                town: "Woodbridge",
                county: "Prince William County",
                state: "Virginia",
                postcode: "22191",
                country_code: "us"
              }
            },
            {
              place_id: 10,
              display_name: "22191, France",
              lat: "48.0",
              lon: "2.0",
              address: {
                postcode: "22191",
                country_code: "fr"
              }
            }
          ]),
          { status: 200 }
        );
      }
    });

    await expect(geocoder.search("22191")).resolves.toEqual([
      {
        id: "22191",
        displayName: "Woodbridge, Prince William County, VA 22191",
        latitude: 38.6326,
        longitude: -77.2644,
        provider: "nominatim",
        locality: "Woodbridge",
        region: "VA",
        postalCode: "22191"
      }
    ]);
    expect(requestedUrl?.searchParams.get("postalcode")).toBe("22191");
    expect(requestedUrl?.searchParams.get("country")).toBe("United States");
    expect(requestedUrl?.searchParams.get("countrycodes")).toBe("us");
    expect(requestedUrl?.searchParams.has("q")).toBe(false);
  });

  it("returns an empty list for no-result geocoding responses", async () => {
    const geocoder = new NominatimGeocoder({
      userAgent: "LocalLoop tests",
      fetchImpl: async () => new Response(JSON.stringify([]), { status: 200 })
    });

    await expect(geocoder.search("not a real place")).resolves.toEqual([]);
  });

  it("surfaces geocoding timeouts", async () => {
    const geocoder = new NominatimGeocoder({
      userAgent: "LocalLoop tests",
      timeoutMs: 1,
      fetchImpl: async (_input, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    });

    await expect(geocoder.search("Arlington")).rejects.toMatchObject({
      code: "timeout"
    });
  });

  it("surfaces unavailable provider responses", async () => {
    const geocoder = new NominatimGeocoder({
      userAgent: "LocalLoop tests",
      fetchImpl: async () => new Response("Service unavailable", { status: 503 })
    });

    await expect(geocoder.search("Arlington")).rejects.toMatchObject({
      code: "unavailable"
    });
  });
});
