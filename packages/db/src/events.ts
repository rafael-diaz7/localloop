import type {
  DmvSearchLocation,
  EventCategory,
  EventDateRange,
  EventPriceStatus,
  EventSearchPrice,
  EventSearchSort
} from "@localloop/domain";
import { and, asc, eq, gte, sql } from "drizzle-orm";

import type { DbClient } from "./client";
import { eventCategoriesTable, events, sources, venues } from "./schema";

export type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  timezone: string;
  venueName: string;
  locality: string;
  region: string;
  categories: EventCategory[];
  priceStatus: "free" | "paid" | "unknown";
  minPriceCents: number | null;
  maxPriceCents: number | null;
  currency: string | null;
  sourceUrl: string;
  sourceDisplayName: string;
};

export type SearchableEvent = UpcomingEvent & {
  displayAddress: string;
  distanceMiles: number;
};

export type SearchEventsInput = {
  location: Pick<DmvSearchLocation, "latitude" | "longitude">;
  radiusMiles: number;
  dateRange: EventDateRange;
  includedCategories: EventCategory[];
  excludedCategories: EventCategory[];
  price: EventSearchPrice;
  sort: EventSearchSort;
  now?: Date;
};

type SearchEventRow = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  timezone: string;
  venueName: string;
  displayAddress: string;
  locality: string;
  region: string;
  categories: EventCategory[] | null;
  priceStatus: EventPriceStatus;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  currency: string | null;
  sourceUrl: string;
  sourceKey: string;
  sourceDisplayName: string | null;
  distanceMiles: number | string;
};

export async function listUpcomingEvents(db: DbClient, now = new Date()): Promise<UpcomingEvent[]> {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startAt: events.startAt,
      endAt: events.endAt,
      timezone: events.timezone,
      venueName: venues.name,
      locality: venues.locality,
      region: venues.region,
      category: eventCategoriesTable.category,
      priceStatus: events.priceStatus,
      minPriceCents: events.minPriceCents,
      maxPriceCents: events.maxPriceCents,
      currency: events.currency,
      sourceUrl: events.sourceUrl,
      sourceKey: events.source,
      sourceDisplayName: sources.displayName
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .leftJoin(eventCategoriesTable, eq(events.id, eventCategoriesTable.eventId))
    .leftJoin(sources, eq(events.source, sources.key))
    .where(and(eq(events.status, "active"), gte(events.startAt, now)))
    .orderBy(asc(events.startAt), asc(events.title));

  const eventsById = new Map<string, UpcomingEvent>();

  for (const row of rows) {
    const existing = eventsById.get(row.id);

    if (existing) {
      if (row.category) {
        existing.categories.push(row.category);
      }
      continue;
    }

    eventsById.set(row.id, {
      id: row.id,
      title: row.title,
      description: row.description,
      startAt: row.startAt,
      endAt: row.endAt,
      timezone: row.timezone,
      venueName: row.venueName,
      locality: row.locality,
      region: row.region,
      categories: row.category ? [row.category] : [],
      priceStatus: row.priceStatus,
      minPriceCents: row.minPriceCents,
      maxPriceCents: row.maxPriceCents,
      currency: row.currency,
      sourceUrl: row.sourceUrl,
      sourceDisplayName: row.sourceDisplayName ?? fallbackSourceDisplayName(row.sourceKey)
    });
  }

  return [...eventsById.values()];
}

export async function searchEvents(
  db: DbClient,
  input: SearchEventsInput
): Promise<SearchableEvent[]> {
  const radiusMeters = input.radiusMiles * 1609.344;
  const now = input.now ?? new Date();
  const center = sql`ST_SetSRID(ST_MakePoint(${input.location.longitude}, ${input.location.latitude}), 4326)::geography`;
  const includedCategories = eventCategoryArray(input.includedCategories);
  const excludedCategories = eventCategoryArray(input.excludedCategories);
  const priceFilter =
    input.price === "any" ? sql`` : sql`and e.price_status = ${input.price}::event_price_status`;
  const includeFilter =
    input.includedCategories.length === 0
      ? sql``
      : sql`and exists (
          select 1
          from event_categories included_ec
          where included_ec.event_id = e.id
            and included_ec.category = any(${includedCategories})
        )`;
  const excludeFilter =
    input.excludedCategories.length === 0
      ? sql``
      : sql`and not exists (
          select 1
          from event_categories excluded_ec
          where excluded_ec.event_id = e.id
            and excluded_ec.category = any(${excludedCategories})
        )`;
  const orderBy =
    input.sort === "closest"
      ? sql`matched.distance_miles asc, matched.start_at asc, matched.title asc`
      : sql`matched.start_at asc, matched.distance_miles asc, matched.title asc`;

  const rows = await db.execute<SearchEventRow>(sql`
    with matched as (
      select
        e.id,
        e.title,
        e.description,
        e.start_at,
        e.end_at,
        e.timezone,
        v.name as venue_name,
        v.display_address,
        v.locality,
        v.region,
        e.price_status,
        e.min_price_cents,
        e.max_price_cents,
        e.currency,
        e.source_url,
        e.source as source_key,
        s.display_name as source_display_name,
        ST_Distance(v.location, ${center}) / 1609.344 as distance_miles
      from events e
      inner join venues v on e.venue_id = v.id
      left join sources s on e.source = s.key
      where e.status = 'active'
        and e.start_at >= ${now.toISOString()}::timestamptz
        and e.start_at >= ${input.dateRange.start.toISOString()}::timestamptz
        and e.start_at < ${input.dateRange.end.toISOString()}::timestamptz
        and v.location is not null
        and ST_DWithin(v.location, ${center}, ${radiusMeters})
        ${priceFilter}
        ${includeFilter}
        ${excludeFilter}
    )
    select
      matched.id,
      matched.title,
      matched.description,
      matched.start_at as "startAt",
      matched.end_at as "endAt",
      matched.timezone,
      matched.venue_name as "venueName",
      matched.display_address as "displayAddress",
      matched.locality,
      matched.region,
      coalesce(
        array_agg(ec.category order by ec.category) filter (where ec.category is not null),
        array[]::event_category[]
      ) as categories,
      matched.price_status as "priceStatus",
      matched.min_price_cents as "minPriceCents",
      matched.max_price_cents as "maxPriceCents",
      matched.currency,
      matched.source_url as "sourceUrl",
      matched.source_key as "sourceKey",
      matched.source_display_name as "sourceDisplayName",
      matched.distance_miles as "distanceMiles"
    from matched
    left join event_categories ec on matched.id = ec.event_id
    group by
      matched.id,
      matched.title,
      matched.description,
      matched.start_at,
      matched.end_at,
      matched.timezone,
      matched.venue_name,
      matched.display_address,
      matched.locality,
      matched.region,
      matched.price_status,
      matched.min_price_cents,
      matched.max_price_cents,
      matched.currency,
      matched.source_url,
      matched.source_key,
      matched.source_display_name,
      matched.distance_miles
    order by ${orderBy}
  `);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    startAt: dateValue(row.startAt),
    endAt: row.endAt ? dateValue(row.endAt) : null,
    timezone: row.timezone,
    venueName: row.venueName,
    displayAddress: row.displayAddress,
    locality: row.locality,
    region: row.region,
    categories: row.categories ?? [],
    priceStatus: row.priceStatus,
    minPriceCents: row.minPriceCents,
    maxPriceCents: row.maxPriceCents,
    currency: row.currency,
    sourceUrl: row.sourceUrl,
    sourceDisplayName: row.sourceDisplayName ?? fallbackSourceDisplayName(row.sourceKey),
    distanceMiles: Number(row.distanceMiles)
  }));
}

function fallbackSourceDisplayName(sourceKey: string) {
  return sourceKey === "local-seed" ? "Demo data" : sourceKey;
}

function dateValue(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function eventCategoryArray(categories: EventCategory[]) {
  if (categories.length === 0) {
    return sql`array[]::event_category[]`;
  }

  return sql`array[${sql.join(
    categories.map((category) => sql`${category}::event_category`),
    sql`, `
  )}]::event_category[]`;
}
