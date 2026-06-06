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
import { eventCategoriesTable, eventGroupMembers, events, sources, venues } from "./schema";

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
  groupId?: string | null;
  duplicateCount: number;
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
  groupId: string | null;
  memberCount: number | string | null;
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
      sourceDisplayName: sources.displayName,
      groupId: eventGroupMembers.groupId,
      memberCount: sql<number | null>`(
        select count(*)::int
        from event_group_members counted_egm
        where counted_egm.group_id = ${eventGroupMembers.groupId}
          and counted_egm.decision in ('auto_group', 'manual_group')
      )`
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .leftJoin(eventCategoriesTable, eq(events.id, eventCategoriesTable.eventId))
    .leftJoin(sources, eq(events.source, sources.key))
    .leftJoin(
      eventGroupMembers,
      and(
        eq(events.id, eventGroupMembers.eventId),
        sql`${eventGroupMembers.decision} in ('auto_group', 'manual_group')`
      )
    )
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
      sourceDisplayName: row.sourceDisplayName ?? fallbackSourceDisplayName(row.sourceKey),
      groupId: row.groupId,
      duplicateCount: duplicateCountFromMemberCount(row.memberCount)
    });
  }

  return [...eventsById.values()];
}

export async function searchEvents(
  db: DbClient,
  input: SearchEventsInput
): Promise<SearchableEvent[]> {
  const rows = await db.execute<SearchEventRow>(buildSearchEventsSql(input));

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
    groupId: row.groupId,
    duplicateCount: duplicateCountFromMemberCount(row.memberCount),
    distanceMiles: Number(row.distanceMiles)
  }));
}

export function buildSearchEventsSql(input: SearchEventsInput) {
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
      ? sql`display_matches.distance_miles asc, e.start_at asc, e.title asc`
      : sql`e.start_at asc, display_matches.distance_miles asc, e.title asc`;

  return sql`
    with matched as (
      select
        coalesce(eg.canonical_event_id, e.id) as display_event_id,
        ST_Distance(v.location, ${center}) / 1609.344 as distance_miles
      from events e
      inner join venues v on e.venue_id = v.id
      left join event_group_members egm
        on egm.event_id = e.id
       and egm.decision in ('auto_group', 'manual_group')
      left join event_groups eg on eg.id = egm.group_id
      where e.status = 'active'
        and e.start_at >= ${now.toISOString()}::timestamptz
        and e.start_at >= ${input.dateRange.start.toISOString()}::timestamptz
        and e.start_at < ${input.dateRange.end.toISOString()}::timestamptz
        and v.location is not null
        and ST_DWithin(v.location, ${center}, ${radiusMeters})
        and not exists (
          select 1
          from event_group_members hidden_egm
          where hidden_egm.event_id = e.id
            and hidden_egm.decision = 'rejected'
            and hidden_egm.reasons->>'standaloneAddon' = 'true'
        )
        ${priceFilter}
        ${includeFilter}
        ${excludeFilter}
    ),
    display_matches as (
      select
        matched.display_event_id,
        min(matched.distance_miles) as distance_miles
      from matched
      group by matched.display_event_id
    ),
    group_metadata as (
      select
        eg.canonical_event_id as event_id,
        eg.id as group_id,
        count(confirmed_egm.event_id)::int as member_count
      from event_groups eg
      inner join event_group_members confirmed_egm
        on confirmed_egm.group_id = eg.id
       and confirmed_egm.decision in ('auto_group', 'manual_group')
      group by eg.canonical_event_id, eg.id
    )
    select
      e.id,
      e.title,
      e.description,
      e.start_at as "startAt",
      e.end_at as "endAt",
      e.timezone,
      v.name as "venueName",
      v.display_address as "displayAddress",
      v.locality,
      v.region,
      coalesce(
        array_agg(ec.category order by ec.category) filter (where ec.category is not null),
        array[]::event_category[]
      ) as categories,
      e.price_status as "priceStatus",
      e.min_price_cents as "minPriceCents",
      e.max_price_cents as "maxPriceCents",
      e.currency,
      e.source_url as "sourceUrl",
      e.source as "sourceKey",
      s.display_name as "sourceDisplayName",
      gm.group_id as "groupId",
      gm.member_count as "memberCount",
      display_matches.distance_miles as "distanceMiles"
    from display_matches
    inner join events e on display_matches.display_event_id = e.id
    inner join venues v on e.venue_id = v.id
    left join sources s on e.source = s.key
    left join event_categories ec on e.id = ec.event_id
    left join group_metadata gm on gm.event_id = e.id
    where e.status = 'active'
      and e.start_at >= ${now.toISOString()}::timestamptz
    group by
      e.id,
      e.title,
      e.description,
      e.start_at,
      e.end_at,
      e.timezone,
      v.name,
      v.display_address,
      v.locality,
      v.region,
      e.price_status,
      e.min_price_cents,
      e.max_price_cents,
      e.currency,
      e.source_url,
      e.source,
      s.display_name,
      gm.group_id,
      gm.member_count,
      display_matches.distance_miles
    order by ${orderBy}
  `;
}

function fallbackSourceDisplayName(sourceKey: string) {
  return sourceKey === "local-seed" ? "Demo data" : sourceKey;
}

function dateValue(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function duplicateCountFromMemberCount(memberCount: number | string | null | undefined) {
  return Math.max(Number(memberCount ?? 1) - 1, 0);
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
