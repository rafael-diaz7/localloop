import { z } from "zod";

export type LocationCandidate = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  provider: "nominatim";
  locality?: string;
  region?: string;
  postalCode?: string;
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
  lon: z.string(),
  type: z.string().optional(),
  address: z
    .object({
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      hamlet: z.string().optional(),
      municipality: z.string().optional(),
      suburb: z.string().optional(),
      neighbourhood: z.string().optional(),
      county: z.string().optional(),
      state: z.string().optional(),
      postcode: z.string().optional(),
      country: z.string().optional(),
      country_code: z.string().optional()
    })
    .passthrough()
    .optional()
});

const nominatimResponseSchema = z.array(nominatimResultSchema);
type NominatimResult = z.infer<typeof nominatimResultSchema>;

const zipCodePattern = /^\d{5}(?:-\d{4})?$/;
const dmvStateCodes = new Set(["DC", "MD", "VA"]);
const stateAbbreviations: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY"
};

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
    if (zipCodePattern.test(trimmedQuery)) {
      url.searchParams.set("postalcode", trimmedQuery);
      url.searchParams.set("country", "United States");
    } else {
      url.searchParams.set("q", trimmedQuery);
    }
    url.searchParams.set("limit", String(this.limit));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("accept-language", "en-US,en;q=0.9");
    url.searchParams.set("viewbox", "-79.7,40.0,-75.0,36.5");
    url.searchParams.set("bounded", "0");

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

      return parsed.data
        .filter(isUnitedStatesResult)
        .sort(
          (left, right) => relevanceScore(right, trimmedQuery) - relevanceScore(left, trimmedQuery)
        )
        .flatMap((result, index) => {
          const latitude = Number(result.lat);
          const longitude = Number(result.lon);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return [];
          }

          const address = result.address;
          const locality = address ? locationLocality(address) : undefined;
          const region = address?.state
            ? (stateAbbreviations[address.state] ?? address.state)
            : undefined;
          const postalCode = address?.postcode;

          return [
            {
              id: String(result.place_id ?? `${latitude},${longitude},${index}`),
              displayName: formatDisplayName(result, locality, region, postalCode),
              latitude,
              longitude,
              provider: "nominatim" as const,
              locality,
              region,
              postalCode
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

function isUnitedStatesResult(result: NominatimResult) {
  const countryCode = result.address?.country_code?.toLowerCase();

  if (countryCode) {
    return countryCode === "us";
  }

  return /\b(united states|usa)\b/i.test(result.display_name);
}

function relevanceScore(result: NominatimResult, query: string) {
  const address = result.address;
  const region = address?.state ? (stateAbbreviations[address.state] ?? address.state) : undefined;
  let score = 0;

  if (region && dmvStateCodes.has(region)) {
    score += 20;
  }

  if (region && new RegExp(`\\b${region}\\b`, "i").test(query)) {
    score += 30;
  }

  if (address?.postcode && query.includes(address.postcode)) {
    score += 30;
  }

  const locality = address ? locationLocality(address) : undefined;
  if (locality && query.toLowerCase().includes(locality.toLowerCase())) {
    score += 10;
  }

  return score;
}

function locationLocality(address: NonNullable<NominatimResult["address"]>) {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.municipality ??
    address.suburb ??
    address.neighbourhood ??
    address.county
  );
}

function formatDisplayName(
  result: NominatimResult,
  locality: string | undefined,
  region: string | undefined,
  postalCode: string | undefined
) {
  const address = result.address;
  const county = address?.county && address.county !== locality ? address.county : undefined;
  const regionAndPostalCode = [region, postalCode].filter(Boolean).join(" ");
  const parts = [locality, county, regionAndPostalCode || undefined].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : result.display_name;
}
