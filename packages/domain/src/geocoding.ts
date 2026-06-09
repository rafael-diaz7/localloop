import { z } from "zod";

export type LocationCandidate = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  provider: "nominatim";
};

export interface Geocoder {
  search(query: string): Promise<LocationCandidate[]>;
}

export type GeocodingErrorCode = "timeout" | "unavailable" | "invalid-response";

export class GeocodingError extends Error {
  constructor(
    readonly code: GeocodingErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GeocodingError";
  }
}

type NominatimGeocoderOptions = {
  userAgent: string;
  endpoint?: string;
  timeoutMs?: number;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const nominatimResultSchema = z.object({
  place_id: z.union([z.string(), z.number()]).optional(),
  display_name: z.string(),
  lat: z.string(),
  lon: z.string()
});

const nominatimResponseSchema = z.array(nominatimResultSchema);

export class NominatimGeocoder implements Geocoder {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly limit: number;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(options: NominatimGeocoderOptions) {
    this.userAgent = options.userAgent.trim();
    this.endpoint = options.endpoint ?? "https://nominatim.openstreetmap.org/search";
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.limit = options.limit ?? 5;
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (!this.userAgent) {
      throw new GeocodingError("unavailable", "Nominatim User-Agent is not configured.");
    }
  }

  async search(query: string): Promise<LocationCandidate[]> {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return [];
    }

    const url = new URL(this.endpoint);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", trimmedQuery);
    url.searchParams.set("limit", String(this.limit));
    url.searchParams.set("addressdetails", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new GeocodingError("unavailable", `Nominatim returned ${response.status}.`);
      }

      const parsed = nominatimResponseSchema.safeParse(await response.json());

      if (!parsed.success) {
        throw new GeocodingError("invalid-response", "Nominatim returned an unexpected response.");
      }

      return parsed.data.flatMap((result, index) => {
        const latitude = Number(result.lat);
        const longitude = Number(result.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return [];
        }

        return [
          {
            id: String(result.place_id ?? `${latitude},${longitude},${index}`),
            displayName: result.display_name,
            latitude,
            longitude,
            provider: "nominatim" as const
          }
        ];
      });
    } catch (error) {
      if (error instanceof GeocodingError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new GeocodingError("timeout", "Nominatim request timed out.");
      }

      throw new GeocodingError("unavailable", "Nominatim is unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
