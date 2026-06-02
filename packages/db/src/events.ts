import type { EventCategory } from "@localloop/domain";
import { and, asc, eq, gte } from "drizzle-orm";

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

function fallbackSourceDisplayName(sourceKey: string) {
  return sourceKey === "local-seed" ? "Demo data" : sourceKey;
}
