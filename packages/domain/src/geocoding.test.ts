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
              lon: "-77.0869"
            }
          ]),
          { status: 200 }
        );
      }
    });

    await expect(geocoder.search("Courthouse Arlington")).resolves.toEqual([
      {
        id: "123",
        displayName: "Courthouse, Arlington, VA, United States",
        latitude: 38.8904,
        longitude: -77.0869,
        provider: "nominatim"
      }
    ]);
    expect(requestedQuery).toBe("Courthouse Arlington");
    expect(requestedUserAgent).toBe("LocalLoop tests");
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
