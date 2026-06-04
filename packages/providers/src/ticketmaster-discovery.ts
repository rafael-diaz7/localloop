import type { EventCategory } from "@localloop/domain";
import { createHash } from "node:crypto";
import { z } from "zod";

import type {
  NormalizedEvent,
  NormalizedEventBatch,
  NormalizedEventSkipReason,
  ProviderSourceIdentity
} from "./event-provider";

const TICKETMASTER_DISCOVERY_ENDPOINT = "https://app.ticketmaster.com/discovery/v2/events.json";
const DEFAULT_DMV_CENTER = {
  latitude: 38.9072,
  longitude: -77.0369
};
const DEFAULT_RADIUS_MILES = 25;
const DEFAULT_TIME_WINDOW_DAYS = 30;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_TIMEZONE = "America/New_York";
const GEOSHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const MISSING_CONCRETE_START_DATE_TIME_SKIP_REASON = {
  key: "missingConcreteStartDateTime",
  label: "Missing concrete start date/time"
};

export const ticketmasterDiscoverySource = {
  key: "ticketmaster-discovery",
  displayName: "Ticketmaster",
  platform: "Ticketmaster Discovery API",
  metadata: {
    endpoint: TICKETMASTER_DISCOVERY_ENDPOINT
  }
} satisfies ProviderSourceIdentity;

export type TicketmasterDiscoveryConfig = {
  apiKey: string;
  radiusMiles?: number;
  centerLatitude?: number;
  centerLongitude?: number;
  timeWindowDays?: number;
  pageSize?: number;
  maxPages?: number;
  now?: Date;
  fetchImpl?: TicketmasterFetch;
};

export type TicketmasterFetch = (input: URL) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;

type NormalizedTicketmasterConfig = {
  apiKey: string;
  radiusMiles: number;
  centerLatitude: number;
  centerLongitude: number;
  timeWindowDays: number;
  pageSize: number;
  maxPages: number;
  now: Date;
};

const ticketmasterEntitySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional()
  })
  .passthrough();

const ticketmasterClassificationSchema = z
  .object({
    primary: z.boolean().optional(),
    segment: ticketmasterEntitySchema.optional(),
    genre: ticketmasterEntitySchema.optional(),
    subGenre: ticketmasterEntitySchema.optional(),
    type: ticketmasterEntitySchema.optional(),
    subType: ticketmasterEntitySchema.optional(),
    family: z.boolean().optional()
  })
  .passthrough();

const ticketmasterVenueSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    timezone: z.string().optional(),
    address: z
      .object({
        line1: z.string().optional(),
        line2: z.string().optional()
      })
      .passthrough()
      .optional(),
    city: ticketmasterEntitySchema.optional(),
    state: ticketmasterEntitySchema.optional(),
    postalCode: z.string().optional(),
    location: z
      .object({
        longitude: z.string().optional(),
        latitude: z.string().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

const ticketmasterEventSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    url: z.string().url().optional(),
    locale: z.string().optional(),
    info: z.string().optional(),
    pleaseNote: z.string().optional(),
    dates: z
      .object({
        start: z
          .object({
            dateTime: z.string().datetime({ offset: true }).optional(),
            localDate: z.string().optional(),
            localTime: z.string().optional()
          })
          .passthrough()
          .optional(),
        end: z
          .object({
            dateTime: z.string().datetime({ offset: true }).optional()
          })
          .passthrough()
          .optional(),
        timezone: z.string().optional(),
        status: z
          .object({
            code: z.string().optional()
          })
          .passthrough()
          .optional()
      })
      .passthrough(),
    priceRanges: z
      .array(
        z
          .object({
            min: z.number().optional(),
            max: z.number().optional(),
            currency: z.string().optional()
          })
          .passthrough()
      )
      .optional(),
    classifications: z.array(ticketmasterClassificationSchema).optional(),
    promoter: ticketmasterEntitySchema.optional(),
    promoters: z.array(ticketmasterEntitySchema).optional(),
    source: ticketmasterEntitySchema.optional(),
    _embedded: z
      .object({
        venues: z.array(ticketmasterVenueSchema).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

const ticketmasterDiscoveryResponseSchema = z
  .object({
    _embedded: z
      .object({
        events: z.array(ticketmasterEventSchema).optional()
      })
      .passthrough()
      .optional(),
    page: z
      .object({
        size: z.number().optional(),
        totalElements: z.number().optional(),
        totalPages: z.number().optional(),
        number: z.number().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export type TicketmasterDiscoveryResponse = z.infer<typeof ticketmasterDiscoveryResponseSchema>;
export type TicketmasterDiscoveryEvent = z.infer<typeof ticketmasterEventSchema>;

export function requireTicketmasterApiKey(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.TICKETMASTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("TICKETMASTER_API_KEY is required to ingest Ticketmaster Discovery events");
  }

  return apiKey;
}

export function parseTicketmasterDiscoveryResponse(input: unknown) {
  return ticketmasterDiscoveryResponseSchema.parse(input);
}

export function normalizeTicketmasterEvent(
  event: TicketmasterDiscoveryEvent,
  fetchedAt = new Date()
): NormalizedEvent | null {
  const startDateTime = event.dates.start?.dateTime;

  if (!startDateTime) {
    return null;
  }

  const venue = event._embedded?.venues?.[0];
  const price = normalizePrice(event.priceRanges);
  const categories = mapTicketmasterClassifications(event.classifications);
  const timezone = event.dates.timezone ?? venue?.timezone ?? DEFAULT_TIMEZONE;

  return {
    externalId: event.id,
    title: event.name,
    description: event.info ?? event.pleaseNote,
    sourceUrl: event.url ?? `https://www.ticketmaster.com/event/${event.id}`,
    startAt: new Date(startDateTime),
    endAt: event.dates.end?.dateTime ? new Date(event.dates.end.dateTime) : undefined,
    timezone,
    venue: {
      externalId: venue?.id,
      name: venue?.name ?? "Unknown venue",
      displayAddress: venue?.address?.line1,
      locality: venue?.city?.name,
      region: stringValue(venue?.state?.stateCode) ?? venue?.state?.name,
      postalCode: venue?.postalCode,
      latitude: parseCoordinate(venue?.location?.latitude),
      longitude: parseCoordinate(venue?.location?.longitude)
    },
    categories,
    priceStatus: price.priceStatus,
    minPriceCents: price.minPriceCents,
    maxPriceCents: price.maxPriceCents,
    currency: price.currency,
    status: mapTicketmasterStatus(event.dates.status?.code),
    providerMetadata: {
      type: event.type,
      locale: event.locale,
      sourceName: event.source?.name,
      promoterId: event.promoter?.id,
      promoterName: event.promoter?.name,
      classifications: event.classifications?.map((classification) => ({
        primary: classification.primary,
        segment: classification.segment?.name,
        genre: classification.genre?.name,
        subGenre: classification.subGenre?.name,
        type: classification.type?.name,
        subType: classification.subType?.name,
        family: classification.family
      })),
      dateStatus: event.dates.status?.code
    },
    rawPayload: {
      payload: sanitizeRawPayload(event),
      fetchedAt
    }
  };
}

export function getTicketmasterEventSkipReason(
  event: TicketmasterDiscoveryEvent
): Omit<NormalizedEventSkipReason, "count"> | undefined {
  if (!event.dates.start?.dateTime) {
    return MISSING_CONCRETE_START_DATE_TIME_SKIP_REASON;
  }

  return undefined;
}

export function mapTicketmasterClassifications(
  classifications: TicketmasterDiscoveryEvent["classifications"] = []
): EventCategory[] {
  const categories = new Set<EventCategory>();

  for (const classification of classifications) {
    const names = [
      classification.segment?.name,
      classification.genre?.name,
      classification.subGenre?.name,
      classification.type?.name,
      classification.subType?.name
    ]
      .filter((name): name is string => Boolean(name))
      .map((name) => name.toLowerCase());

    if (classification.family) {
      categories.add("family");
    }

    for (const name of names) {
      const category = mapClassificationName(name);

      if (category) {
        categories.add(category);
      }
    }
  }

  return categories.size > 0 ? [...categories] : ["other"];
}

export function buildTicketmasterDiscoveryUrl(
  config: Required<
    Pick<
      TicketmasterDiscoveryConfig,
      | "apiKey"
      | "radiusMiles"
      | "centerLatitude"
      | "centerLongitude"
      | "timeWindowDays"
      | "pageSize"
    >
  > & {
    page: number;
    now: Date;
  }
) {
  const startDateTime = formatTicketmasterDateTime(config.now);
  const endDateTime = new Date(
    config.now.getTime() + config.timeWindowDays * 24 * 60 * 60 * 1000
  );
  const url = new URL(TICKETMASTER_DISCOVERY_ENDPOINT);

  url.searchParams.set("apikey", config.apiKey);
  url.searchParams.set("geoPoint", encodeGeohash(config.centerLatitude, config.centerLongitude));
  url.searchParams.set("radius", String(config.radiusMiles));
  url.searchParams.set("unit", "miles");
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("startDateTime", startDateTime);
  url.searchParams.set("endDateTime", formatTicketmasterDateTime(endDateTime));
  url.searchParams.set("includeTBA", "no");
  url.searchParams.set("includeTBD", "no");
  url.searchParams.set("includeTest", "no");
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", String(config.pageSize));
  url.searchParams.set("page", String(config.page));
  url.searchParams.set("locale", "en-us");

  return url;
}

export async function fetchTicketmasterDiscoveryEvents(
  config: TicketmasterDiscoveryConfig
): Promise<NormalizedEventBatch> {
  const normalizedConfig = normalizeConfig(config);
  const fetchImpl = config.fetchImpl ?? fetch;
  const eventsByExternalId = new Map<string, NormalizedEvent>();
  const skippedReasons = new Map<string, NormalizedEventSkipReason>();
  let fetchedCount = 0;
  let skippedCount = 0;

  for (let page = 0; page < normalizedConfig.maxPages; page += 1) {
    const url = buildTicketmasterDiscoveryUrl({
      ...normalizedConfig,
      page
    });
    const response = await fetchImpl(url);

    if (!response.ok) {
      throw new Error(
        `Ticketmaster Discovery API request failed with ${response.status} ${response.statusText}`
      );
    }

    const parsed = parseTicketmasterDiscoveryResponse(await response.json());
    const pageEvents = parsed._embedded?.events ?? [];
    fetchedCount += pageEvents.length;

    for (const event of pageEvents) {
      const skipReason = getTicketmasterEventSkipReason(event);

      if (skipReason) {
        skippedCount += 1;
        incrementSkipReason(skippedReasons, skipReason);
        continue;
      }

      const normalizedEvent = normalizeTicketmasterEvent(event, normalizedConfig.now);

      if (!normalizedEvent) {
        skippedCount += 1;
        continue;
      }

      eventsByExternalId.set(normalizedEvent.externalId, normalizedEvent);
    }

    const currentPage = parsed.page?.number ?? page;
    const totalPages = parsed.page?.totalPages;

    if (!totalPages || currentPage >= totalPages - 1) {
      break;
    }
  }

  return {
    source: ticketmasterDiscoverySource,
    events: [...eventsByExternalId.values()],
    fetchedCount,
    skippedCount,
    skippedReasons: [...skippedReasons.values()],
    metadata: {
      radiusMiles: normalizedConfig.radiusMiles,
      centerLatitude: normalizedConfig.centerLatitude,
      centerLongitude: normalizedConfig.centerLongitude,
      timeWindowDays: normalizedConfig.timeWindowDays,
      maxPages: normalizedConfig.maxPages,
      pageSize: normalizedConfig.pageSize,
      skippedReasons: [...skippedReasons.values()],
      requestParameters: ticketmasterRequestParameterSummary(normalizedConfig)
    }
  };
}

function incrementSkipReason(
  skippedReasons: Map<string, NormalizedEventSkipReason>,
  reason: Omit<NormalizedEventSkipReason, "count">
) {
  const existingReason = skippedReasons.get(reason.key);

  skippedReasons.set(reason.key, {
    ...reason,
    count: (existingReason?.count ?? 0) + 1
  });
}

export function payloadHash(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function normalizeConfig(config: TicketmasterDiscoveryConfig): NormalizedTicketmasterConfig {
  return {
    apiKey: config.apiKey,
    radiusMiles: positiveInteger(config.radiusMiles, DEFAULT_RADIUS_MILES),
    centerLatitude: config.centerLatitude ?? DEFAULT_DMV_CENTER.latitude,
    centerLongitude: config.centerLongitude ?? DEFAULT_DMV_CENTER.longitude,
    timeWindowDays: positiveInteger(config.timeWindowDays, DEFAULT_TIME_WINDOW_DAYS),
    pageSize: positiveInteger(config.pageSize, DEFAULT_PAGE_SIZE),
    maxPages: positiveInteger(config.maxPages, DEFAULT_MAX_PAGES),
    now: config.now ?? new Date()
  };
}

function ticketmasterRequestParameterSummary(config: NormalizedTicketmasterConfig) {
  return {
    geoPoint: encodeGeohash(config.centerLatitude, config.centerLongitude),
    radius: config.radiusMiles,
    unit: "miles",
    countryCode: "US",
    startDateTime: formatTicketmasterDateTime(config.now),
    endDateTime: formatTicketmasterDateTime(
      new Date(config.now.getTime() + config.timeWindowDays * 24 * 60 * 60 * 1000)
    ),
    includeTBA: "no",
    includeTBD: "no",
    includeTest: "no",
    sort: "date,asc",
    size: config.pageSize,
    maxPages: config.maxPages,
    locale: "en-us"
  };
}

function normalizePrice(priceRanges: TicketmasterDiscoveryEvent["priceRanges"] = []) {
  if (priceRanges.length === 0) {
    return {
      priceStatus: "unknown" as const,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      currency: undefined
    };
  }

  const ranges = priceRanges.filter((range) => range.min !== undefined || range.max !== undefined);

  if (ranges.length === 0) {
    return {
      priceStatus: "unknown" as const,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      currency: priceRanges[0]?.currency
    };
  }

  const minDollars = Math.min(
    ...ranges
      .map((range) => range.min ?? range.max)
      .filter((price): price is number => price !== undefined)
  );
  const maxDollars = Math.max(
    ...ranges
      .map((range) => range.max ?? range.min)
      .filter((price): price is number => price !== undefined)
  );

  return {
    priceStatus: minDollars === 0 && maxDollars === 0 ? ("free" as const) : ("paid" as const),
    minPriceCents: Math.round(minDollars * 100),
    maxPriceCents: Math.round(maxDollars * 100),
    currency: ranges.find((range) => range.currency)?.currency
  };
}

function mapTicketmasterStatus(statusCode: string | undefined) {
  return statusCode?.toLowerCase().includes("cancel")
    ? ("cancelled" as const)
    : ("active" as const);
}

function mapClassificationName(name: string): EventCategory | undefined {
  if (name.includes("music")) {
    return "music";
  }

  if (name.includes("sport") || name.includes("fitness")) {
    return "sports-fitness";
  }

  if (
    name.includes("arts") ||
    name.includes("theatre") ||
    name.includes("theater") ||
    name.includes("comedy") ||
    name.includes("dance") ||
    name.includes("museum")
  ) {
    return "arts-culture";
  }

  if (name.includes("family") || name.includes("children")) {
    return "family";
  }

  if (name.includes("food") || name.includes("drink")) {
    return "food-drink";
  }

  if (name.includes("business") || name.includes("network")) {
    return "business-networking";
  }

  if (name.includes("education") || name.includes("lecture") || name.includes("workshop")) {
    return "education";
  }

  if (name.includes("outdoor") || name.includes("recreation")) {
    return "outdoors";
  }

  if (name.includes("community") || name.includes("festival") || name.includes("fair")) {
    return "community";
  }

  return undefined;
}

function parseCoordinate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const coordinate = Number(value);

  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function sanitizeRawPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizePayloadValue(payload) as Record<string, unknown>;
}

function sanitizePayloadValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "images")
      .map(([key, nestedValue]) => [key, sanitizePayloadValue(nestedValue)])
  );
}

function positiveInteger(value: number | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function formatTicketmasterDateTime(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function encodeGeohash(latitude: number, longitude: number, precision = 6) {
  let evenBit = true;
  let bit = 0;
  let ch = 0;
  let geohash = "";
  let latitudeRange: [number, number] = [-90, 90];
  let longitudeRange: [number, number] = [-180, 180];

  while (geohash.length < precision) {
    if (evenBit) {
      const midpoint = (longitudeRange[0] + longitudeRange[1]) / 2;

      if (longitude >= midpoint) {
        ch = (ch << 1) + 1;
        longitudeRange = [midpoint, longitudeRange[1]];
      } else {
        ch <<= 1;
        longitudeRange = [longitudeRange[0], midpoint];
      }
    } else {
      const midpoint = (latitudeRange[0] + latitudeRange[1]) / 2;

      if (latitude >= midpoint) {
        ch = (ch << 1) + 1;
        latitudeRange = [midpoint, latitudeRange[1]];
      } else {
        ch <<= 1;
        latitudeRange = [latitudeRange[0], midpoint];
      }
    }

    evenBit = !evenBit;

    if (bit < 4) {
      bit += 1;
    } else {
      geohash += GEOSHASH_BASE32[ch] ?? "";
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}
