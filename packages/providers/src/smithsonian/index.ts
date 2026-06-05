import type { EventCategory, EventPriceStatus } from "@localloop/domain";

import type {
  NormalizedEvent,
  NormalizedEventBatch,
  NormalizedEventSkipReason,
  ProviderSourceIdentity
} from "../event-provider";

export const SMITHSONIAN_EVENTS_FEED_URL =
  "https://www.trumba.com/calendars/smithsonian-events.xml";
const DEFAULT_TIMEZONE = "America/New_York";
const NON_DMV_LOCATION_SKIP_REASON = {
  key: "nonDmvLocation",
  label: "Location is not clearly in DC, Maryland, or Virginia"
};
const MISSING_REQUIRED_FIELD_SKIP_REASON = {
  key: "missingRequiredField",
  label: "Missing required event identity, title, or start time"
};
const KNOWN_DMV_VENUES = [
  "african american history and culture museum",
  "african art museum",
  "air and space museum",
  "american art museum",
  "american history museum",
  "american indian museum",
  "anacostia community museum",
  "archives of american art",
  "arts and industries building",
  "asian art museum",
  "hirshhorn museum",
  "national air and space museum",
  "national museum of african american history and culture",
  "national museum of african art",
  "national museum of american history",
  "national museum of natural history",
  "national museum of the american indian",
  "national portrait gallery",
  "national postal museum",
  "national zoo",
  "natural history museum",
  "portrait gallery",
  "postal museum",
  "renwick gallery",
  "s. dillon ripley center",
  "smithsonian castle",
  "smithsonian gardens",
  "steven f. udvar-hazy center",
  "udvar-hazy center"
];

export const smithsonianSource = {
  key: "smithsonian",
  displayName: "Smithsonian Institution",
  platform: "Trumba Atom Feed",
  metadata: {
    endpoint: SMITHSONIAN_EVENTS_FEED_URL,
    attribution: "Event data sourced from Smithsonian Institution calendar via Trumba Atom feed."
  }
} satisfies ProviderSourceIdentity;

export type SmithsonianFetch = (input: string) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

export type SmithsonianFeedEntry = {
  id?: string;
  title?: string;
  content?: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  where?: string;
  eventLocation?: string;
  categories: string[];
  cost?: string;
  sponsor?: string;
  sourceUrl?: string;
  registrationUrl?: string;
  imageUrl?: string;
  accessibility?: string;
  rawXml: string;
};

export type SmithsonianProbeEvent = {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  venue: string;
  sponsor?: string;
  categories: string[];
  cost?: string;
  sourceUrl: string;
};

export type SmithsonianProbeSummary = {
  totalEvents: number;
  categoryCounts: Record<string, number>;
  venueCounts: Record<string, number>;
  freeEventCount: number;
  paidEventCount: number;
  unknownPricingCount: number;
};

export async function fetchSmithsonianEvents(
  config: {
    fetchImpl?: SmithsonianFetch;
    now?: Date;
  } = {}
): Promise<NormalizedEventBatch> {
  const fetchedAt = config.now ?? new Date();
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(SMITHSONIAN_EVENTS_FEED_URL);

  if (!response.ok) {
    throw new Error(
      `Smithsonian feed request failed with ${response.status} ${response.statusText}`
    );
  }

  return buildSmithsonianEventBatch(await response.text(), fetchedAt);
}

export function buildSmithsonianEventBatch(
  xml: string,
  fetchedAt = new Date()
): NormalizedEventBatch {
  const entries = parseSmithsonianFeed(xml);
  const events = new Map<string, NormalizedEvent>();
  const skippedReasons = new Map<string, NormalizedEventSkipReason>();
  let skippedCount = 0;

  for (const entry of entries) {
    const normalizedEvent = normalizeSmithsonianEvent(entry, fetchedAt);

    if (!normalizedEvent) {
      skippedCount += 1;
      incrementSkipReason(skippedReasons, MISSING_REQUIRED_FIELD_SKIP_REASON);
      continue;
    }

    if (!isLikelyDmvSmithsonianEvent(entry)) {
      skippedCount += 1;
      incrementSkipReason(skippedReasons, NON_DMV_LOCATION_SKIP_REASON);
      continue;
    }

    events.set(normalizedEvent.externalId, normalizedEvent);
  }

  return {
    source: smithsonianSource,
    events: [...events.values()],
    fetchedCount: entries.length,
    skippedCount,
    skippedReasons: [...skippedReasons.values()],
    metadata: {
      endpoint: SMITHSONIAN_EVENTS_FEED_URL,
      fetchedAt: fetchedAt.toISOString(),
      dmvFilter:
        "Imports only events whose venue, event location, or gd:where text contains a clear DC, Maryland, Virginia, or known DMV Smithsonian venue signal.",
      skippedReasons: [...skippedReasons.values()]
    }
  };
}

export function parseSmithsonianFeed(xml: string): SmithsonianFeedEntry[] {
  return matchElements(xml, "entry").map(parseSmithsonianEntry);
}

export function normalizeSmithsonianEvent(
  entry: SmithsonianFeedEntry,
  fetchedAt = new Date()
): NormalizedEvent | null {
  const externalId = trimToUndefined(entry.id);
  const title = trimToUndefined(entry.title);
  const startAt = parseDate(entry.startTime);

  if (!externalId || !title || !startAt) {
    return null;
  }

  const cost = trimToUndefined(entry.cost);
  const eventLocation = trimToUndefined(entry.eventLocation);
  const where = trimToUndefined(entry.where);
  const venueName = trimToUndefined(entry.venue) ?? where ?? eventLocation ?? "Unknown venue";
  const categories = mapSmithsonianCategories(entry.categories);

  return {
    externalId,
    title,
    description: trimToUndefined(entry.notes) ?? trimToUndefined(entry.content),
    sourceUrl: trimToUndefined(entry.sourceUrl) ?? externalId,
    startAt,
    endAt: parseDate(entry.endTime),
    timezone: DEFAULT_TIMEZONE,
    venue: {
      externalId: stableVenueExternalId(venueName, eventLocation ?? where),
      name: venueName,
      displayAddress: eventLocation ?? where,
      locality: inferLocality(eventLocation ?? where ?? venueName),
      region: inferRegion(eventLocation ?? where ?? venueName)
    },
    categories,
    priceStatus: mapSmithsonianPriceStatus(cost),
    status: "active",
    providerMetadata: {
      sponsor: trimToUndefined(entry.sponsor),
      rawCost: cost,
      sourceCategories: entry.categories,
      eventLocation,
      registrationUrl: trimToUndefined(entry.registrationUrl),
      imageUrl: trimToUndefined(entry.imageUrl),
      accessibility: trimToUndefined(entry.accessibility)
    },
    rawPayload: {
      payload: {
        id: entry.id,
        title: entry.title,
        startTime: entry.startTime,
        endTime: entry.endTime,
        venue: entry.venue,
        where: entry.where,
        eventLocation: entry.eventLocation,
        categories: entry.categories,
        cost: entry.cost,
        sponsor: entry.sponsor,
        sourceUrl: entry.sourceUrl,
        registrationUrl: entry.registrationUrl,
        imageUrl: entry.imageUrl,
        accessibility: entry.accessibility
      },
      fetchedAt
    }
  };
}

export function normalizeSmithsonianProbeEvents(xml: string, limit = 100): SmithsonianProbeEvent[] {
  return parseSmithsonianFeed(xml)
    .slice(0, limit)
    .map(normalizeSmithsonianProbeEvent)
    .filter((event): event is SmithsonianProbeEvent => Boolean(event));
}

export function summarizeSmithsonianProbeEvents(
  events: SmithsonianProbeEvent[]
): SmithsonianProbeSummary {
  const categoryCounts: Record<string, number> = {};
  const venueCounts: Record<string, number> = {};
  let freeEventCount = 0;
  let paidEventCount = 0;
  let unknownPricingCount = 0;

  for (const event of events) {
    for (const category of event.categories.length > 0 ? event.categories : ["Uncategorized"]) {
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }

    venueCounts[event.venue] = (venueCounts[event.venue] ?? 0) + 1;

    switch (mapSmithsonianPriceStatus(event.cost)) {
      case "free":
        freeEventCount += 1;
        break;
      case "paid":
        paidEventCount += 1;
        break;
      case "unknown":
        unknownPricingCount += 1;
        break;
    }
  }

  return {
    totalEvents: events.length,
    categoryCounts: sortCountRecord(categoryCounts),
    venueCounts: sortCountRecord(venueCounts),
    freeEventCount,
    paidEventCount,
    unknownPricingCount
  };
}

export function mapSmithsonianPriceStatus(cost?: string): EventPriceStatus {
  const normalizedCost = cost?.toLowerCase() ?? "";

  if (normalizedCost.includes("free")) {
    return "free";
  }

  if (
    normalizedCost.includes("price") ||
    normalizedCost.includes("ticket") ||
    normalizedCost.includes("$") ||
    normalizedCost.includes("registration")
  ) {
    return "paid";
  }

  return "unknown";
}

export function mapSmithsonianCategories(categories: string[]): EventCategory[] {
  const mappedCategories = new Set<EventCategory>();

  for (const category of categories) {
    const normalizedCategory = category.trim().toLowerCase();

    if (normalizedCategory === "gallery talks & tours") {
      mappedCategories.add("arts-culture");
    } else if (normalizedCategory === "kids & families") {
      mappedCategories.add("family");
    } else if (normalizedCategory === "workshops") {
      mappedCategories.add("education");
    } else if (normalizedCategory === "performances") {
      mappedCategories.add("arts-culture");
    } else if (normalizedCategory === "culinary arts") {
      mappedCategories.add("food-drink");
    } else if (normalizedCategory === "after five") {
      mappedCategories.add("arts-culture");
    }
  }

  return mappedCategories.size > 0 ? [...mappedCategories] : ["other"];
}

export function isLikelyDmvSmithsonianEvent(entry: SmithsonianFeedEntry) {
  const locationText = [entry.venue, entry.where, entry.eventLocation]
    .filter((value): value is string => Boolean(trimToUndefined(value)))
    .join(" ");
  const normalizedLocationText = normalizeWhitespace(locationText).toLowerCase();

  if (!normalizedLocationText) {
    return false;
  }

  return (
    /\bwashington\s*,?\s*d\.?c\.?\b/.test(normalizedLocationText) ||
    normalizedLocationText.includes("district of columbia") ||
    /\bdc\b/.test(normalizedLocationText) ||
    /\bd\.c\.\b/.test(normalizedLocationText) ||
    normalizedLocationText.includes("maryland") ||
    /\bmd\b/.test(normalizedLocationText) ||
    normalizedLocationText.includes("virginia") ||
    /\bva\b/.test(normalizedLocationText) ||
    KNOWN_DMV_VENUES.some((venue) => normalizedLocationText.includes(venue))
  );
}

function parseSmithsonianEntry(rawXml: string): SmithsonianFeedEntry {
  const eventImage =
    elementText(rawXml, "eventimage") ?? elementAttribute(rawXml, "eventimage", "href");
  const detailImage =
    elementText(rawXml, "detailimage") ?? elementAttribute(rawXml, "detailimage", "href");

  return {
    id: elementText(rawXml, "id"),
    title: elementText(rawXml, "title"),
    content: stripHtml(elementText(rawXml, "content")),
    notes: stripHtml(elementText(rawXml, "notes")),
    startTime: elementAttribute(rawXml, "when", "startTime"),
    endTime: elementAttribute(rawXml, "when", "endTime"),
    venue: elementText(rawXml, "venue"),
    where: elementText(rawXml, "where") ?? elementAttribute(rawXml, "where", "valueString"),
    eventLocation: elementText(rawXml, "eventlocation"),
    categories: splitCategories(elementText(rawXml, "categories")),
    cost: elementText(rawXml, "cost"),
    sponsor: elementText(rawXml, "sponsor"),
    sourceUrl: alternateLink(rawXml),
    registrationUrl: elementText(rawXml, "getticketsregister"),
    imageUrl: trimToUndefined(eventImage) ?? trimToUndefined(detailImage),
    accessibility: elementText(rawXml, "accessibility"),
    rawXml
  };
}

function normalizeSmithsonianProbeEvent(
  entry: SmithsonianFeedEntry
): SmithsonianProbeEvent | undefined {
  const externalId = trimToUndefined(entry.id);
  const title = trimToUndefined(entry.title);
  const startsAt = trimToUndefined(entry.startTime);
  const sourceUrl = trimToUndefined(entry.sourceUrl) ?? externalId;

  if (!externalId || !title || !startsAt || !sourceUrl) {
    return undefined;
  }

  return {
    externalId,
    title,
    startsAt,
    endsAt: trimToUndefined(entry.endTime),
    venue: trimToUndefined(entry.venue) ?? trimToUndefined(entry.where) ?? "Unknown venue",
    sponsor: trimToUndefined(entry.sponsor),
    categories: entry.categories,
    cost: trimToUndefined(entry.cost),
    sourceUrl
  };
}

function matchElements(xml: string, localName: string) {
  const pattern = new RegExp(
    `<([A-Za-z_][\\w.-]*:)?${localName}\\b[^>]*>[\\s\\S]*?<\\/\\1?${localName}>`,
    "gi"
  );

  return [...xml.matchAll(pattern)].map((match) => match[0]);
}

function elementText(xml: string, localName: string) {
  const match = xml.match(
    new RegExp(`<([A-Za-z_][\\w.-]*:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/\\1?${localName}>`, "i")
  );

  return match?.[2] ? trimToUndefined(decodeXml(stripCdata(match[2]))) : undefined;
}

function elementAttribute(xml: string, localName: string, attributeName: string) {
  const match = xml.match(new RegExp(`<([A-Za-z_][\\w.-]*:)?${localName}\\b([^>]*)\\/?>`, "i"));

  if (!match?.[2]) {
    return undefined;
  }

  return attributeValue(match[2], attributeName);
}

function alternateLink(xml: string) {
  const linkPattern = /<([A-Za-z_][\w.-]*:)?link\b([^>]*)\/?>/gi;

  for (const match of xml.matchAll(linkPattern)) {
    const attributes = match[2] ?? "";
    const rel = attributeValue(attributes, "rel");

    if (rel === "alternate") {
      return attributeValue(attributes, "href");
    }
  }

  return undefined;
}

function attributeValue(attributes: string, attributeName: string) {
  const match = attributes.match(
    new RegExp(`\\b${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")
  );
  const rawValue = match?.[2] ?? match?.[3];

  return rawValue ? trimToUndefined(decodeXml(rawValue)) : undefined;
}

function splitCategories(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(/[,;|\n]+/)
    .map((category) => normalizeWhitespace(category))
    .filter((category) => category.length > 0);
}

function stripCdata(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripHtml(value?: string) {
  if (!value) {
    return undefined;
  }

  return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stableVenueExternalId(venueName: string, location?: string) {
  return normalizeWhitespace([venueName, location].filter(Boolean).join(" "))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function inferLocality(locationText: string) {
  const normalized = normalizeWhitespace(locationText);
  const dcMatch = normalized.match(/\bWashington\s*,?\s*D\.?C\.?\b/i);

  if (dcMatch) {
    return "Washington";
  }

  const cityStateMatch = normalized.match(/\b([^,]+),\s*(DC|D\.C\.|MD|VA|Maryland|Virginia)\b/i);

  if (cityStateMatch?.[1]) {
    return cityStateMatch[1].trim();
  }

  const normalizedLowercase = normalized.toLowerCase();

  if (
    normalizedLowercase.includes("steven f. udvar-hazy center") ||
    normalizedLowercase.includes("udvar-hazy center")
  ) {
    return "Chantilly";
  }

  if (KNOWN_DMV_VENUES.some((venue) => normalizedLowercase.includes(venue))) {
    return "Washington";
  }

  return undefined;
}

function inferRegion(locationText: string) {
  const normalized = normalizeWhitespace(locationText);

  if (/\bD\.?C\.?\b/i.test(normalized) || /District of Columbia/i.test(normalized)) {
    return "DC";
  }

  if (/\bMD\b/i.test(normalized) || /Maryland/i.test(normalized)) {
    return "MD";
  }

  if (/\bVA\b/i.test(normalized) || /Virginia/i.test(normalized)) {
    return "VA";
  }

  const normalizedLowercase = normalized.toLowerCase();

  if (
    normalizedLowercase.includes("steven f. udvar-hazy center") ||
    normalizedLowercase.includes("udvar-hazy center")
  ) {
    return "VA";
  }

  if (KNOWN_DMV_VENUES.some((venue) => normalizedLowercase.includes(venue))) {
    return "DC";
  }

  return undefined;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimToUndefined(value?: string) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
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

function sortCountRecord(record: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
  );
}
